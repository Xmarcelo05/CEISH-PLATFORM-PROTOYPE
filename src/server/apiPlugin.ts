// ============================================================================
// Plugin de Vite que expone un pequeño conjunto de rutas /api/* respaldadas
// por PostgreSQL y MinIO. Corre dentro del proceso Node del dev server de Vite
// — NO es un proyecto backend separado ni un framework (Express/Nest); es solo
// el punto donde el frontend (navegador) obtiene datos y archivos sin hablar
// TCP con la BD ni con el object storage.
// ============================================================================

import type { Plugin, Connect } from 'vite';
import type { ServerResponse } from 'node:http';

import { sendJson, readJsonBody, parseMultipart, MAX_BYTES } from './httpHelpers';
import { handleCeishRoute } from './ceishApiRoutes';
import { listUsers, listUsersByRole, getUserById } from './queries/users';
import {
  listSubmissions, getSubmissionByStudent, getSubmissionById,
  createSubmission, updateSubmission, deleteSubmission, getDocumentPath,
} from './queries/submissions';
import {
  listAssignments, listAssignmentsByTeacher, createAssignment, deleteAssignment,
} from './queries/assignments';
import { getReviewBySubmission, getOrCreateReview, saveReview } from './queries/reviews';
import { loginUser } from './queries/auth';
import type { SaveReviewInput } from './queries/reviews';
import { uploadFile, getPresignedUrl, getObjectStream } from '../lib/minio';

/** Resuelve una petición /api/* y devuelve true si la manejó. */
async function handle(req: Connect.IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '', 'http://localhost');
  const path = url.pathname;
  const method = (req.method ?? 'GET').toUpperCase();
  if (!path.startsWith('/api/')) return false;

  // ── Auth ───────────────────────────────────────────────────────────────
  if (path === '/api/auth/login' && method === 'POST') {
    const b = await readJsonBody(req);
    if (!b.email || !b.password) {
      sendJson(res, 400, { error: 'Email y contraseña son requeridos' });
      return true;
    }
    const user = await loginUser(String(b.email), String(b.password));
    if (!user) {
      sendJson(res, 401, { error: 'Credenciales incorrectas' });
      return true;
    }
    sendJson(res, 200, { user });
    return true;
  }

  // ── Users ──────────────────────────────────────────────────────────────
  if (path === '/api/users' && method === 'GET') {
    const role = url.searchParams.get('role');
    sendJson(res, 200, role ? await listUsersByRole(role) : await listUsers());
    return true;
  }
  const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && method === 'GET') {
    const user = await getUserById(userMatch[1]);
    sendJson(res, user ? 200 : 404, user ?? { error: 'Usuario no encontrado' });
    return true;
  }

  // ── Upload de documentos (multipart/form-data) ───────────────────────────
  // POST /api/upload  campo "file" -> sube a MinIO y devuelve la referencia
  if (path === '/api/upload' && method === 'POST') {
    const { file, tooLarge } = await parseMultipart(req);
    if (tooLarge) {
      sendJson(res, 413, { error: `El archivo supera el límite de ${MAX_BYTES / 1024 / 1024} MB` });
      return true;
    }
    if (!file) {
      sendJson(res, 400, { error: 'No se recibió ningún archivo' });
      return true;
    }
    const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.jpg', '.jpeg', '.png'];
    const lowerName = file.filename.toLowerCase();
    const isAllowed = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!isAllowed) {
      sendJson(res, 415, { error: 'Solo se permiten archivos PDF, Word (.docx) o imágenes (jpg/png)' });
      return true;
    }
    const documentPath = await uploadFile(file.buffer, file.filename, file.mimeType || 'application/octet-stream');
    sendJson(res, 201, { documentPath, documentName: file.filename, size: file.buffer.length });
    return true;
  }

  // GET /api/documents/:id/raw -> transmite el PDF (mismo origen, para incrustarlo)
  const docRawMatch = path.match(/^\/api\/documents\/([^/]+)\/raw$/);
  if (docRawMatch && method === 'GET') {
    const key = await getDocumentPath(docRawMatch[1]);
    if (!key) {
      sendJson(res, 404, { error: 'La entrega no tiene documento asociado' });
      return true;
    }
    try {
      const stream = await getObjectStream(key);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      stream.on('error', () => { res.destroy(); });
      stream.pipe(res);
    } catch {
      sendJson(res, 404, { error: 'El documento no existe en el almacenamiento' });
    }
    return true;
  }

  // GET /api/documents/:id -> URL temporal firmada para visualizar el PDF
  const docMatch = path.match(/^\/api\/documents\/([^/]+)$/);
  if (docMatch && method === 'GET') {
    const key = await getDocumentPath(docMatch[1]);
    if (!key) {
      sendJson(res, 404, { error: 'La entrega no tiene documento asociado' });
      return true;
    }
    const signedUrl = await getPresignedUrl(key);
    sendJson(res, 200, { url: signedUrl });
    return true;
  }

  // ── Submissions ────────────────────────────────────────────────────────
  if (path === '/api/submissions' && method === 'GET') {
    const studentId = url.searchParams.get('studentId');
    sendJson(res, 200, studentId ? await getSubmissionByStudent(studentId) : await listSubmissions());
    return true;
  }
  if (path === '/api/submissions' && method === 'POST') {
    const b = await readJsonBody(req);
    const created = await createSubmission({
      studentId: String(b.studentId),
      documentName: String(b.documentName),
      documentPath: (b.documentPath as string | undefined) ?? null,
      comment: String(b.comment ?? ''),
    });
    sendJson(res, 201, created);
    return true;
  }
  const subMatch = path.match(/^\/api\/submissions\/([^/]+)$/);
  if (subMatch && method === 'GET') {
    const sub = await getSubmissionById(subMatch[1]);
    sendJson(res, sub ? 200 : 404, sub ?? { error: 'Entrega no encontrada' });
    return true;
  }
  if (subMatch && method === 'PATCH') {
    const b = await readJsonBody(req);
    const updated = await updateSubmission(subMatch[1], {
      documentName: b.documentName as string | undefined,
      comment: b.comment as string | undefined,
      documentPath: b.documentPath as string | undefined,
    });
    sendJson(res, updated ? 200 : 404, updated ?? { error: 'Entrega no encontrada' });
    return true;
  }
  if (subMatch && method === 'DELETE') {
    await deleteSubmission(subMatch[1]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // ── Assignments ──────────────────────────────────────────────────────────
  if (path === '/api/assignments' && method === 'GET') {
    const teacherId = url.searchParams.get('teacherId');
    sendJson(res, 200, teacherId ? await listAssignmentsByTeacher(teacherId) : await listAssignments());
    return true;
  }
  if (path === '/api/assignments' && method === 'POST') {
    const b = await readJsonBody(req);
    const created = await createAssignment(String(b.teacherId), String(b.studentId));
    sendJson(res, 201, created);
    return true;
  }
  const assignMatch = path.match(/^\/api\/assignments\/([^/]+)$/);
  if (assignMatch && method === 'DELETE') {
    await deleteAssignment(assignMatch[1]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // ── Reviews ──────────────────────────────────────────────────────────────
  if (path === '/api/reviews' && method === 'POST') {
    const b = await readJsonBody(req);
    const review = await getOrCreateReview(String(b.submissionId), String(b.evaluatorId));
    sendJson(res, 200, review);
    return true;
  }
  const reviewMatch = path.match(/^\/api\/reviews\/([^/]+)$/);
  if (reviewMatch && method === 'GET') {
    const review = await getReviewBySubmission(reviewMatch[1]);
    sendJson(res, review ? 200 : 404, review ?? { error: 'Revisión no encontrada' });
    return true;
  }
  if (reviewMatch && method === 'PUT') {
    const b = await readJsonBody(req);
    await saveReview(b as unknown as SaveReviewInput);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // ── Motor CEISH v3 ─────────────────────────────────────────────────────
  if (path.startsWith('/api/ceish/')) {
    const handled = await handleCeishRoute(req, res, path, method, url);
    if (handled) return true;
  }

  sendJson(res, 404, { error: 'Ruta de API no encontrada' });
  return true;
}

export function apiPlugin(): Plugin {
  return {
    name: 'ceish-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          await handle(req, res);
        } catch (err) {
          console.error('[api] Error procesando', req.url, err);
          sendJson(res, 500, { error: 'Error interno del servidor' });
        }
      });
    },
  };
}
