// ============================================================================
// Rutas /api/ceish/* — motor configurable de workflows CEISH v3.
// Extraído de apiPlugin.ts (que ya es un if-chain manual largo) para no seguir
// haciendo crecer ese archivo; apiPlugin.ts delega aquí todo lo que empiece
// con /api/ceish/. Mismo estilo: sin librería de router, matching manual.
// ============================================================================

import type { Connect } from 'vite';
import type { ServerResponse } from 'node:http';

import { sendJson, readJsonBody, parseMultipart } from './httpHelpers';
import { getPresignedUrl, getObjectStream, uploadFile } from '../lib/minio';
import {
  listAnexoTemplates, createAnexoTemplate, updateAnexoTemplate, deleteAnexoTemplate,
} from './queries/ceish/anexoTemplates';
import type { AnexoTemplateInput } from './queries/ceish/anexoTemplates';
import {
  listTiposDocumento, createTipoDocumento, updateTipoDocumento, deleteTipoDocumento,
} from './queries/ceish/tiposDocumento';
import type { SeccionInput } from './queries/ceish/tiposDocumento';
import {
  listDocumentos, getDocumentoById, listAsignaciones,
  crearDocumento, editarDocumento, solicitarRevision, subirCorreccion,
} from './queries/ceish/documentos';
import type { CrearDocumentoInput, EditarDocumentoInput } from './queries/ceish/documentos';
import {
  listRespuestasAnexo, guardarRespuestaAnexo, emitirAnexo, darseDeBajaRevisor, elevarRiesgoTecnica,
} from './queries/ceish/respuestas';
import type { GuardarRespuestaInput, EmitirAnexoInput } from './queries/ceish/respuestas';
import {
  listNotificaciones, enviarNotificacionManual, marcarNotificacionLeida,
} from './queries/ceish/notificaciones';
import {
  listEscalamientos, crearEscalamiento, resolverEscalamiento,
} from './queries/ceish/escalamientos';
import { resetDemoData } from './queries/ceish/reset';

function toAnexoTemplateInput(b: Record<string, unknown>): AnexoTemplateInput {
  return {
    numero: Number(b.numero),
    nombre: String(b.nombre ?? ''),
    rol: b.rol as 'investigador' | 'evaluador',
    preguntas: (b.preguntas as AnexoTemplateInput['preguntas']) ?? [],
    wordTemplateName: (b.wordTemplateName as string | undefined) ?? null,
    wordTemplateObjectKey: (b.wordTemplateObjectKey as string | undefined) ?? null,
  };
}

/** Resuelve una petición /api/ceish/* y devuelve true si la manejó. */
export async function handleCeishRoute(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  path: string,
  method: string,
  url: URL,
): Promise<boolean> {
  // ── Plantillas de Anexo ──────────────────────────────────────────────────
  if (path === '/api/ceish/anexo-templates' && method === 'GET') {
    sendJson(res, 200, await listAnexoTemplates());
    return true;
  }
  if (path === '/api/ceish/anexo-templates' && method === 'POST') {
    const b = await readJsonBody(req);
    sendJson(res, 201, await createAnexoTemplate(toAnexoTemplateInput(b)));
    return true;
  }
  const anexoMatch = path.match(/^\/api\/ceish\/anexo-templates\/([^/]+)$/);
  if (anexoMatch && method === 'PUT') {
    const b = await readJsonBody(req);
    const updated = await updateAnexoTemplate(anexoMatch[1], toAnexoTemplateInput(b));
    sendJson(res, updated ? 200 : 404, updated ?? { error: 'Plantilla de anexo no encontrada' });
    return true;
  }
  if (anexoMatch && method === 'DELETE') {
    sendJson(res, 200, await deleteAnexoTemplate(anexoMatch[1]));
    return true;
  }

  // ── Tipos de Documento ───────────────────────────────────────────────────
  if (path === '/api/ceish/tipos-documento' && method === 'GET') {
    sendJson(res, 200, await listTiposDocumento());
    return true;
  }
  if (path === '/api/ceish/tipos-documento' && method === 'POST') {
    const b = await readJsonBody(req);
    const created = await createTipoDocumento(String(b.nombre ?? ''), (b.secciones as SeccionInput[]) ?? []);
    sendJson(res, 201, created);
    return true;
  }
  const tipoMatch = path.match(/^\/api\/ceish\/tipos-documento\/([^/]+)$/);
  if (tipoMatch && method === 'PUT') {
    const b = await readJsonBody(req);
    const updated = await updateTipoDocumento(
      tipoMatch[1], String(b.nombre ?? ''), (b.secciones as SeccionInput[]) ?? [],
    );
    sendJson(res, updated ? 200 : 404, updated ?? { error: 'Tipo de documento no encontrado' });
    return true;
  }
  if (tipoMatch && method === 'DELETE') {
    await deleteTipoDocumento(tipoMatch[1]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // ── Reset de datos de demo (solo desarrollo, botón "Restablecer prototipo") ─
  if (path === '/api/ceish/reset-demo-data' && method === 'POST') {
    await resetDemoData();
    sendJson(res, 200, { ok: true });
    return true;
  }

  // ── Documentos (trámites) ─────────────────────────────────────────────────
  if (path === '/api/ceish/documentos' && method === 'GET') {
    const investigadorId = url.searchParams.get('investigadorId') ?? undefined;
    sendJson(res, 200, await listDocumentos(investigadorId));
    return true;
  }
  if (path === '/api/ceish/documentos' && method === 'POST') {
    const b = await readJsonBody(req);
    const input: CrearDocumentoInput = {
      tipoDocumentoId: String(b.tipoDocumentoId ?? ''),
      tema: String(b.tema ?? ''),
      descripcion: String(b.descripcion ?? ''),
      autores: (b.autores as CrearDocumentoInput['autores']) ?? [],
      riesgoDeclarado: b.riesgoDeclarado as CrearDocumentoInput['riesgoDeclarado'],
      miembrosCeishDeclarados: (b.miembrosCeishDeclarados as string[]) ?? [],
      investigadorId: String(b.investigadorId ?? ''),
      investigadorNombre: String(b.investigadorNombre ?? ''),
      documentName: String(b.documentName ?? ''),
      documentPath: String(b.documentPath ?? ''),
    };
    sendJson(res, 201, await crearDocumento(input));
    return true;
  }
  const documentoMatch = path.match(/^\/api\/ceish\/documentos\/([^/]+)$/);
  if (documentoMatch && method === 'GET') {
    const documento = await getDocumentoById(documentoMatch[1]);
    sendJson(res, documento ? 200 : 404, documento ?? { error: 'Documento no encontrado' });
    return true;
  }
  if (documentoMatch && method === 'PATCH') {
    const b = await readJsonBody(req);
    const campos: EditarDocumentoInput = {
      tema: String(b.tema ?? ''),
      descripcion: String(b.descripcion ?? ''),
      riesgoDeclarado: b.riesgoDeclarado as EditarDocumentoInput['riesgoDeclarado'],
      riesgoConfirmado: (b.riesgoConfirmado as EditarDocumentoInput['riesgoConfirmado']) ?? null,
      estado: b.estado as EditarDocumentoInput['estado'],
    };
    const nuevoEvaluadorId = typeof b.nuevoEvaluadorId === 'string' ? b.nuevoEvaluadorId : undefined;
    const result = await editarDocumento(documentoMatch[1], campos, nuevoEvaluadorId);
    sendJson(res, result ? 200 : 404, result ?? { error: 'Documento no encontrado' });
    return true;
  }

  const solicitarMatch = path.match(/^\/api\/ceish\/documentos\/([^/]+)\/solicitar-revision$/);
  if (solicitarMatch && method === 'POST') {
    const b = await readJsonBody(req);
    try {
      const result = await solicitarRevision(solicitarMatch[1], String(b.solicitanteNombre ?? ''));
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : 'Error al solicitar revisión.' });
    }
    return true;
  }

  // POST /api/ceish/documentos/:id/subir-correccion — multipart (archivo + comentario opcional)
  const correccionMatch = path.match(/^\/api\/ceish\/documentos\/([^/]+)\/subir-correccion$/);
  if (correccionMatch && method === 'POST') {
    const { fields, file, tooLarge } = await parseMultipart(req);
    if (tooLarge) { sendJson(res, 413, { error: 'El archivo supera el límite permitido.' }); return true; }
    if (!file) { sendJson(res, 400, { error: 'No se recibió ningún archivo.' }); return true; }
    const objectKey = await uploadFile(file.buffer, file.filename, file.mimeType || 'application/octet-stream');
    const result = await subirCorreccion(
      correccionMatch[1], file.filename, objectKey, fields.investigadorNombre ?? '', fields.comentario ?? '',
    );
    sendJson(res, result ? 200 : 404, result ?? { error: 'Documento no encontrado' });
    return true;
  }

  // POST /api/ceish/documentos/:id/baja-revisor — inhibición del evaluador por conflicto
  const bajaMatch = path.match(/^\/api\/ceish\/documentos\/([^/]+)\/baja-revisor$/);
  if (bajaMatch && method === 'POST') {
    const b = await readJsonBody(req);
    try {
      const result = await darseDeBajaRevisor(
        bajaMatch[1], String(b.evaluadorId ?? ''), String(b.evaluadorNombre ?? ''), String(b.comentarioConflicto ?? ''),
      );
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : 'Error al procesar la inhibición del revisor.' });
    }
    return true;
  }

  // POST /api/ceish/documentos/:id/elevar-riesgo — Estratificación con riesgo -> Revisión Técnica (2 evaluadores)
  const elevarRiesgoMatch = path.match(/^\/api\/ceish\/documentos\/([^/]+)\/elevar-riesgo$/);
  if (elevarRiesgoMatch && method === 'POST') {
    const b = await readJsonBody(req);
    try {
      const result = await elevarRiesgoTecnica(
        elevarRiesgoMatch[1], String(b.evaluadorId ?? ''), String(b.evaluadorNombre ?? ''),
        b.nuevoRiesgoConfirmado as 'riesgo-minimo' | 'riesgo-mayor', String(b.justificacion ?? ''),
      );
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : 'Error al elevar el riesgo del proyecto.' });
    }
    return true;
  }

  // ── Asignaciones ───────────────────────────────────────────────────────────
  if (path === '/api/ceish/asignaciones' && method === 'GET') {
    sendJson(res, 200, await listAsignaciones());
    return true;
  }

  // ── Respuestas de Anexo (borradores + emisiones) ────────────────────────────
  if (path === '/api/ceish/respuestas' && method === 'GET') {
    const documentoId = url.searchParams.get('documentoId') ?? undefined;
    sendJson(res, 200, await listRespuestasAnexo(documentoId));
    return true;
  }
  if (path === '/api/ceish/respuestas' && method === 'PUT') {
    const b = await readJsonBody(req);
    const input: GuardarRespuestaInput = {
      documentoId: String(b.documentoId ?? ''),
      anexoTemplateId: String(b.anexoTemplateId ?? ''),
      seccionId: String(b.seccionId ?? ''),
      versionArchivoId: String(b.versionArchivoId ?? ''),
      emitidoPorId: String(b.emitidoPorId ?? ''),
      emitidoPorNombre: String(b.emitidoPorNombre ?? ''),
      valores: (b.valores as GuardarRespuestaInput['valores']) ?? [],
      comentariosAnotados: (b.comentariosAnotados as GuardarRespuestaInput['comentariosAnotados']) ?? [],
    };
    try {
      sendJson(res, 200, await guardarRespuestaAnexo(input));
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : 'Error al guardar la respuesta.' });
    }
    return true;
  }
  if (path === '/api/ceish/respuestas/emitir' && method === 'POST') {
    const b = await readJsonBody(req);
    const input: EmitirAnexoInput = {
      documentoId: String(b.documentoId ?? ''),
      anexoTemplateId: String(b.anexoTemplateId ?? ''),
      seccionId: String(b.seccionId ?? ''),
      versionArchivoId: String(b.versionArchivoId ?? ''),
      emitidoPorId: String(b.emitidoPorId ?? ''),
      emitidoPorNombre: String(b.emitidoPorNombre ?? ''),
      valores: (b.valores as EmitirAnexoInput['valores']) ?? [],
      comentariosAnotados: (b.comentariosAnotados as EmitirAnexoInput['comentariosAnotados']) ?? [],
      resultado: b.resultado as EmitirAnexoInput['resultado'],
      nuevoEstado: b.nuevoEstado as EmitirAnexoInput['nuevoEstado'],
      cambioComentario: b.cambioComentario as string | undefined,
      nuevoRiesgoConfirmado: b.nuevoRiesgoConfirmado as EmitirAnexoInput['nuevoRiesgoConfirmado'],
    };
    try {
      sendJson(res, 200, await emitirAnexo(input));
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : 'Error al emitir el anexo.' });
    }
    return true;
  }

  // ── Notificaciones ───────────────────────────────────────────────────────
  if (path === '/api/ceish/notificaciones' && method === 'GET') {
    const destinatarioId = url.searchParams.get('destinatarioId') ?? undefined;
    sendJson(res, 200, await listNotificaciones(destinatarioId));
    return true;
  }
  if (path === '/api/ceish/notificaciones/manual' && method === 'POST') {
    const b = await readJsonBody(req);
    const destinatarioIds = (b.destinatarioIds as string[]) ?? [];
    sendJson(res, 201, await enviarNotificacionManual(destinatarioIds, String(b.mensaje ?? '')));
    return true;
  }
  const notifLeidaMatch = path.match(/^\/api\/ceish\/notificaciones\/([^/]+)\/leida$/);
  if (notifLeidaMatch && method === 'PATCH') {
    const updated = await marcarNotificacionLeida(notifLeidaMatch[1]);
    sendJson(res, updated ? 200 : 404, updated ?? { error: 'Notificación no encontrada' });
    return true;
  }

  // ── Escalamientos ────────────────────────────────────────────────────────
  if (path === '/api/ceish/escalamientos' && method === 'GET') {
    const estado = url.searchParams.get('estado') as 'pendiente' | 'resuelto' | null;
    sendJson(res, 200, await listEscalamientos(estado ?? undefined));
    return true;
  }
  if (path === '/api/ceish/escalamientos' && method === 'POST') {
    const b = await readJsonBody(req);
    const result = await crearEscalamiento(
      String(b.documentoId ?? ''),
      String(b.seccionId ?? ''),
      String(b.anexoTemplateId ?? ''),
      String(b.comentarioEvaluador ?? ''),
      (b.respuestaAnexoId as string | undefined) || null,
    );
    sendJson(res, 201, result);
    return true;
  }
  const resolverEscMatch = path.match(/^\/api\/ceish\/escalamientos\/([^/]+)\/resolver$/);
  if (resolverEscMatch && method === 'PUT') {
    const b = await readJsonBody(req);
    const updated = await resolverEscalamiento(resolverEscMatch[1], String(b.edicionAdmin ?? ''));
    sendJson(res, updated ? 200 : 404, updated ?? { error: 'Escalamiento no encontrado' });
    return true;
  }

  // ── Archivos (MinIO genérico por clave; PDFs/adjuntos/plantillas Word) ────
  // La clave de MinIO (p. ej. "documents/<uuid>.docx") viaja tal cual en el
  // path, sin encodeURIComponent, porque solo tiene un nivel de "/" y ambos
  // segmentos son literales seguros en una URL.
  const fileRawMatch = path.match(/^\/api\/ceish\/files\/(.+)\/raw$/);
  if (fileRawMatch && method === 'GET') {
    try {
      const stream = await getObjectStream(fileRawMatch[1]);
      res.statusCode = 200;
      res.setHeader('Content-Disposition', 'inline');
      stream.on('error', () => { res.destroy(); });
      stream.pipe(res);
    } catch {
      sendJson(res, 404, { error: 'El archivo no existe en el almacenamiento' });
    }
    return true;
  }
  const fileMatch = path.match(/^\/api\/ceish\/files\/(.+)$/);
  if (fileMatch && method === 'GET') {
    const url = await getPresignedUrl(fileMatch[1]);
    sendJson(res, 200, { url });
    return true;
  }

  return false;
}
