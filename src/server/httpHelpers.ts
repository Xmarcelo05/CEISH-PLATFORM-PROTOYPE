// ============================================================================
// Helpers HTTP compartidos por las rutas /api/* (lado servidor, dev server de
// Vite). Extraído de apiPlugin.ts para poder reutilizarlo desde ceishApiRoutes.ts
// sin duplicar el parseo de JSON/multipart.
// ============================================================================

import type { Connect } from 'vite';
import type { ServerResponse } from 'node:http';
import busboy from 'busboy';

export const MAX_BYTES = Number(process.env.UPLOAD_MAX_MB ?? 15) * 1024 * 1024;

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/** Lee y parsea el cuerpo JSON de la petición. */
export function readJsonBody(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    // Se acumulan los Buffers y se decodifican UNA sola vez al final: decodificar
    // cada chunk por separado (p. ej. con `raw += chunk`) corrompe caracteres
    // multibyte (tildes, ñ) cuando quedan partidos entre dos chunks del stream.
    req.on('data', (chunk: Buffer) => { chunks.push(chunk); });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export interface ParsedFile { buffer: Buffer; filename: string; mimeType: string }
export interface ParsedMultipart { fields: Record<string, string>; file: ParsedFile | null; tooLarge: boolean }

/** Parsea un multipart/form-data con un único archivo (límite de tamaño aplicado). */
export function parseMultipart(req: Connect.IncomingMessage): Promise<ParsedMultipart> {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_BYTES } });
    const fields: Record<string, string> = {};
    let file: ParsedFile | null = null;
    let tooLarge = false;

    bb.on('field', (name, value) => { fields[name] = value; });
    bb.on('file', (_name, stream, info) => {
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('limit', () => { tooLarge = true; });
      stream.on('end', () => {
        file = { buffer: Buffer.concat(chunks), filename: info.filename, mimeType: info.mimeType };
      });
    });
    bb.on('close', () => resolve({ fields, file, tooLarge }));
    bb.on('error', reject);
    req.pipe(bb);
  });
}
