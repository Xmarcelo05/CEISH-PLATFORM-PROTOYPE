// ============================================================================
// Cliente de MinIO (object storage para documentos PDF).
//
// IMPORTANTE: se ejecuta ÚNICAMENTE del lado del servidor (proceso Node del dev
// server de Vite), nunca en el navegador. El navegador solo recibe URLs firmadas.
//
// Los PDF se guardan como objetos en el bucket "documents"; PostgreSQL almacena
// únicamente la clave del objeto (document_path).
// ============================================================================

import { Client } from 'minio';
import { randomUUID } from 'node:crypto';

const BUCKET = process.env.MINIO_BUCKET ?? 'documents';

let client: Client | null = null;
let bucketReady: Promise<void> | null = null;

/** Devuelve el cliente único de MinIO. */
export function getMinio(): Client {
  if (!client) {
    client = new Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
      accessKey: process.env.MINIO_ROOT_USER ?? 'minioadmin',
      secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'minioadmin',
    });
  }
  return client;
}

/** Garantiza que el bucket exista (idempotente, se ejecuta una sola vez). */
export function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const c = getMinio();
      const exists = await c.bucketExists(BUCKET).catch(() => false);
      if (!exists) await c.makeBucket(BUCKET);
    })();
  }
  return bucketReady;
}

/** Sube un archivo (PDF, imagen o .docx) y devuelve la clave del objeto almacenado. */
export async function uploadFile(buffer: Buffer, originalName: string, contentType: string): Promise<string> {
  await ensureBucket();
  const dot = originalName.lastIndexOf('.');
  const ext = dot >= 0 ? originalName.slice(dot) : '';
  const key = `documents/${randomUUID()}${ext}`;
  await getMinio().putObject(BUCKET, key, buffer, buffer.length, {
    'Content-Type': contentType,
    'X-Amz-Meta-Original-Name': encodeURIComponent(originalName),
  });
  return key;
}

/** Genera una URL temporal (firmada) para visualizar un objeto. */
export async function getPresignedUrl(key: string, expirySeconds = 300): Promise<string> {
  await ensureBucket();
  return getMinio().presignedGetObject(BUCKET, key, expirySeconds);
}

/** Devuelve un stream de lectura del objeto (para transmitirlo al navegador). */
export async function getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
  await ensureBucket();
  return getMinio().getObject(BUCKET, key);
}
