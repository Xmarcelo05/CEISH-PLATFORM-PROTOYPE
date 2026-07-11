// Consultas SQL de trámites (documentos) y asignaciones del motor CEISH.
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../../lib/database';
import { insertNotificaciones } from './notificaciones';
import type { NotificacionEvento, NotificacionRow } from './notificaciones';
import type {
  Autor, RiesgoTipo, DocumentoEstado, VersionArchivo, HistorialEstado, Cronometro,
} from '../../../shared/types/platform.types';

export interface DocumentoRow {
  id: string;
  codigo: string;
  tipo_documento_id: string;
  tema: string;
  descripcion: string;
  investigador_id: string;
  autores: Autor[];
  riesgo_declarado: RiesgoTipo;
  riesgo_confirmado: RiesgoTipo | null;
  miembros_ceish_declarados: string[];
  estado: DocumentoEstado;
  versiones_archivo: VersionArchivo[];
  historial_estados: HistorialEstado[];
  cronometro: Cronometro | null;
  created_at: string;
}

export interface AsignacionRow {
  id: string;
  documento_id: string;
  seccion_id: string;
  evaluador_id: string;
  active: boolean;
  baja_motivo: string | null;
  baja_anexo_id: string | null;
  assigned_at: string;
}

const DOC_COLUMNS = `id, codigo, tipo_documento_id, tema, descripcion, investigador_id, autores,
  riesgo_declarado, riesgo_confirmado, miembros_ceish_declarados, estado, versiones_archivo,
  historial_estados, cronometro, created_at`;

export async function listDocumentos(investigadorId?: string): Promise<DocumentoRow[]> {
  if (investigadorId) {
    return query<DocumentoRow>(
      `SELECT ${DOC_COLUMNS} FROM ceish_documentos WHERE investigador_id = $1 ORDER BY created_at DESC`,
      [investigadorId],
    );
  }
  return query<DocumentoRow>(`SELECT ${DOC_COLUMNS} FROM ceish_documentos ORDER BY created_at DESC`);
}

export async function getDocumentoById(id: string): Promise<DocumentoRow | null> {
  const rows = await query<DocumentoRow>(`SELECT ${DOC_COLUMNS} FROM ceish_documentos WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listAsignaciones(): Promise<AsignacionRow[]> {
  return query<AsignacionRow>(
    `SELECT id, documento_id, seccion_id, evaluador_id, active, baja_motivo, baja_anexo_id, assigned_at
       FROM ceish_asignaciones ORDER BY assigned_at`,
  );
}

interface EvaluadorCandidato { id: string; cedula: string | null }

/** Evaluadores reales (rol 'teacher' en BD) menos las exclusiones manuales y por conflicto de cédula. */
async function evaluadoresDisponibles(
  client: PoolClient,
  autores: Autor[],
  exclusionesManual: string[],
): Promise<{ disponibles: EvaluadorCandidato[]; exclusiones: Set<string> }> {
  const res = await client.query<EvaluadorCandidato>(
    `SELECT u.id, u.cedula FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'teacher'`,
  );
  const exclusiones = new Set(exclusionesManual);
  for (const autor of autores) {
    const match = res.rows.find((e) => e.cedula && e.cedula === autor.cedula);
    if (match) exclusiones.add(match.id);
  }
  return { disponibles: res.rows.filter((e) => !exclusiones.has(e.id)), exclusiones };
}

// ── Crear documento (registro inicial del investigador) ────────────────────
export interface CrearDocumentoInput {
  tipoDocumentoId: string;
  tema: string;
  descripcion: string;
  autores: Autor[];
  riesgoDeclarado: RiesgoTipo;
  miembrosCeishDeclarados: string[];
  investigadorId: string;
  investigadorNombre: string;
  documentName: string;
  documentPath: string;
}

export interface CrearDocumentoResult { documento: DocumentoRow; notificaciones: NotificacionRow[] }

export async function crearDocumento(input: CrearDocumentoInput): Promise<CrearDocumentoResult> {
  return withTransaction(async (client) => {
    const tipoRes = await client.query<{ secciones: { id: string }[] }>(
      'SELECT secciones FROM ceish_tipos_documento WHERE id = $1', [input.tipoDocumentoId],
    );
    const secciones = tipoRes.rows[0]?.secciones ?? [];
    const seccionAsignada = secciones[1]; // Etapa de Estratificación, misma convención que el prototipo en memoria

    const { disponibles, exclusiones } = await evaluadoresDisponibles(client, input.autores, input.miembrosCeishDeclarados);
    const evaluadorSeleccionado = seccionAsignada && disponibles.length > 0
      ? disponibles[Math.floor(Math.random() * disponibles.length)]
      : null;

    const timestamp = new Date().toISOString();
    const versionesArchivo: VersionArchivo[] = [{
      id: randomUUID(),
      documentName: input.documentName,
      documentPath: input.documentPath,
      comment: 'Documento inicial cargado al registrar el trámite.',
      uploadedAt: timestamp,
    }];

    let estado: DocumentoEstado = 'creada';
    const historialEstados: HistorialEstado[] = [{
      estado: 'creada', changedAt: timestamp, changedBy: input.investigadorNombre,
      comment: 'Trámite registrado e iniciado.',
    }];
    const eventos: NotificacionEvento[] = [];

    if (evaluadorSeleccionado) {
      estado = 'estratificacion';
      historialEstados.push({
        estado: 'estratificacion', changedAt: timestamp, changedBy: 'Sistema CEISH',
        comment: 'Asignación ciega automatizada tras completar Etapa 1.',
      });
    }

    const codigoRes = await client.query<{ codigo: string }>(
      `SELECT 'CEISH-' || EXTRACT(YEAR FROM NOW())::text || '-' ||
              LPAD(nextval('ceish_documento_codigo_seq')::text, 4, '0') AS codigo`,
    );
    const codigo = codigoRes.rows[0].codigo;

    const inserted = await client.query<DocumentoRow>(
      `INSERT INTO ceish_documentos (codigo, tipo_documento_id, tema, descripcion, investigador_id, autores,
         riesgo_declarado, miembros_ceish_declarados, estado, versiones_archivo, historial_estados, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12)
       RETURNING ${DOC_COLUMNS}`,
      [
        codigo, input.tipoDocumentoId, input.tema, input.descripcion, input.investigadorId,
        JSON.stringify(input.autores), input.riesgoDeclarado, JSON.stringify(Array.from(exclusiones)),
        estado, JSON.stringify(versionesArchivo), JSON.stringify(historialEstados), timestamp,
      ],
    );
    const documento = inserted.rows[0];

    if (evaluadorSeleccionado && seccionAsignada) {
      await client.query(
        `INSERT INTO ceish_asignaciones (documento_id, seccion_id, evaluador_id, active, assigned_at)
         VALUES ($1,$2,$3,TRUE,$4)`,
        [documento.id, seccionAsignada.id, evaluadorSeleccionado.id, timestamp],
      );
      eventos.push(
        { destinatarioId: input.investigadorId, mensaje: `Tu proyecto ${codigo} avanzó a la etapa de Estratificación.` },
        { destinatarioId: evaluadorSeleccionado.id, mensaje: `Se te ha asignado el proyecto ${codigo} para evaluación.` },
      );
    }

    const notificaciones = await insertNotificaciones(client, eventos);
    return { documento, notificaciones };
  });
}

// ── Editar documento (admin) ────────────────────────────────────────────────
export interface EditarDocumentoInput {
  tema: string;
  descripcion: string;
  riesgoDeclarado: RiesgoTipo;
  riesgoConfirmado: RiesgoTipo | null;
  estado: DocumentoEstado;
}

export interface EditarDocumentoResult { documento: DocumentoRow; notificaciones: NotificacionRow[] }

export async function editarDocumento(
  id: string,
  campos: EditarDocumentoInput,
  nuevoEvaluadorId: string | undefined,
): Promise<EditarDocumentoResult | null> {
  return withTransaction(async (client) => {
    const existing = await client.query<DocumentoRow>(`SELECT ${DOC_COLUMNS} FROM ceish_documentos WHERE id = $1`, [id]);
    const doc = existing.rows[0];
    if (!doc) return null;

    const timestamp = new Date().toISOString();
    const estadoCambiado = campos.estado !== doc.estado;
    let estadoFinal = campos.estado;
    const historialEstados = [...doc.historial_estados];
    if (estadoCambiado) {
      historialEstados.push({
        estado: campos.estado, changedAt: timestamp, changedBy: 'Administrador',
        comment: `Estado modificado manualmente por el Administrador a: ${campos.estado}.`,
      });
    }

    const eventos: NotificacionEvento[] = [];
    const activasRes = await client.query<{ evaluador_id: string }>(
      `SELECT evaluador_id FROM ceish_asignaciones WHERE documento_id = $1 AND active = TRUE`, [id],
    );
    const evaluadoresActivosPrevios = activasRes.rows.map((r) => r.evaluador_id);

    // Notificación (5b): cualquier edición directa del admin avisa a investigador + evaluador(es) activos.
    eventos.push(...[doc.investigador_id, ...evaluadoresActivosPrevios].map((destinatarioId) => ({
      destinatarioId, mensaje: `El Administrador modificó el proyecto ${doc.codigo}.`,
    })));

    if (nuevoEvaluadorId !== undefined) {
      await client.query(
        `UPDATE ceish_asignaciones SET active = FALSE, baja_motivo = $2 WHERE documento_id = $1 AND active = TRUE`,
        [id, nuevoEvaluadorId ? 'Reasignado por el Administrador.' : 'Removido por el Administrador.'],
      );

      if (nuevoEvaluadorId) {
        const seccionId = estadoFinal === 'revision-tecnica' ? 'sec-evaluacion' : 'sec-estratificacion';
        await client.query(
          `INSERT INTO ceish_asignaciones (documento_id, seccion_id, evaluador_id, active, assigned_at)
           VALUES ($1,$2,$3,TRUE,$4)`,
          [id, seccionId, nuevoEvaluadorId, timestamp],
        );
        if (estadoFinal === 'creada') {
          estadoFinal = 'estratificacion';
          historialEstados.push({
            estado: 'estratificacion', changedAt: timestamp, changedBy: 'Administrador',
            comment: 'Asignación manual de revisor. Proyecto pasa a etapa de Estratificación.',
          });
        }
        eventos.push({
          destinatarioId: nuevoEvaluadorId, mensaje: `Se te ha asignado el proyecto ${doc.codigo} para evaluación.`,
        });
      }
    }

    const updated = await client.query<DocumentoRow>(
      `UPDATE ceish_documentos
          SET tema = $2, descripcion = $3, riesgo_declarado = $4, riesgo_confirmado = $5,
              estado = $6, historial_estados = $7::jsonb
        WHERE id = $1
        RETURNING ${DOC_COLUMNS}`,
      [id, campos.tema, campos.descripcion, campos.riesgoDeclarado, campos.riesgoConfirmado, estadoFinal, JSON.stringify(historialEstados)],
    );

    const notificaciones = await insertNotificaciones(client, eventos);
    return { documento: updated.rows[0], notificaciones };
  });
}

// ── Solicitar revisión (investigador) ───────────────────────────────────────
export interface SolicitarRevisionResult { documento: DocumentoRow; notificaciones: NotificacionRow[] }

export async function solicitarRevision(documentoId: string, solicitanteNombre: string): Promise<SolicitarRevisionResult> {
  return withTransaction(async (client) => {
    const docRes = await client.query<DocumentoRow>(`SELECT ${DOC_COLUMNS} FROM ceish_documentos WHERE id = $1`, [documentoId]);
    const doc = docRes.rows[0];
    if (!doc) throw new Error('Documento no encontrado.');

    const tipoRes = await client.query<{ secciones: { id: string }[] }>(
      'SELECT secciones FROM ceish_tipos_documento WHERE id = $1', [doc.tipo_documento_id],
    );
    const seccionAsignada = (tipoRes.rows[0]?.secciones ?? [])[1];
    if (!seccionAsignada) throw new Error('El tipo de documento no tiene una segunda sección configurada.');

    const { disponibles, exclusiones } = await evaluadoresDisponibles(client, doc.autores, doc.miembros_ceish_declarados);
    if (disponibles.length === 0) {
      throw new Error('No existen evaluadores disponibles sin conflicto de interés en la plataforma para este proyecto.');
    }
    const evaluadorSeleccionado = disponibles[Math.floor(Math.random() * disponibles.length)];

    const timestamp = new Date().toISOString();
    const historialEstados = [...doc.historial_estados, {
      estado: 'estratificacion' as DocumentoEstado, changedAt: timestamp, changedBy: solicitanteNombre,
      comment: 'Solicitud enviada a revisión. Revisor asignado automáticamente por asignación ciega.',
    }];

    const updated = await client.query<DocumentoRow>(
      `UPDATE ceish_documentos SET estado = 'estratificacion', miembros_ceish_declarados = $2::jsonb, historial_estados = $3::jsonb
        WHERE id = $1 RETURNING ${DOC_COLUMNS}`,
      [documentoId, JSON.stringify(Array.from(exclusiones)), JSON.stringify(historialEstados)],
    );

    await client.query(
      `INSERT INTO ceish_asignaciones (documento_id, seccion_id, evaluador_id, active, assigned_at) VALUES ($1,$2,$3,TRUE,$4)`,
      [documentoId, seccionAsignada.id, evaluadorSeleccionado.id, timestamp],
    );

    const eventos: NotificacionEvento[] = [
      { destinatarioId: doc.investigador_id, mensaje: `Tu proyecto ${doc.codigo} avanzó a la etapa de Estratificación.` },
      { destinatarioId: evaluadorSeleccionado.id, mensaje: `Se te ha asignado el proyecto ${doc.codigo} para evaluación.` },
    ];

    const notificaciones = await insertNotificaciones(client, eventos);
    return { documento: updated.rows[0], notificaciones };
  });
}

// ── Subir corrección (investigador sube nueva versión del archivo) ─────────
export interface SubirCorreccionResult { documento: DocumentoRow }

export async function subirCorreccion(
  documentoId: string,
  documentName: string,
  documentPath: string,
  investigadorNombre: string,
  comentario: string,
): Promise<SubirCorreccionResult | null> {
  return withTransaction(async (client) => {
    const docRes = await client.query<DocumentoRow>(`SELECT ${DOC_COLUMNS} FROM ceish_documentos WHERE id = $1`, [documentoId]);
    const doc = docRes.rows[0];
    if (!doc) return null;

    const timestamp = new Date().toISOString();
    const nuevaVersion: VersionArchivo = {
      id: randomUUID(), documentName, documentPath,
      comment: 'Nueva versión con correcciones cargadas.', uploadedAt: timestamp,
    };
    const versionesArchivo = [...doc.versiones_archivo, nuevaVersion];

    let comentarioHistorial = 'Investigador subió una nueva versión del archivo para revisión técnica.';
    if (comentario.trim()) {
      comentarioHistorial += ` Observaciones del Investigador: "${comentario.trim()}"`;
    }
    const historialEstados = [...doc.historial_estados, {
      estado: 'revision-tecnica' as DocumentoEstado, changedAt: timestamp, changedBy: investigadorNombre,
      comment: comentarioHistorial,
    }];

    // Reactivar asignaciones previas que hubiesen quedado inactivas sin motivo de baja explícito
    await client.query(
      `UPDATE ceish_asignaciones SET active = TRUE WHERE documento_id = $1 AND active = FALSE AND baja_motivo IS NULL`,
      [documentoId],
    );

    const updated = await client.query<DocumentoRow>(
      `UPDATE ceish_documentos SET estado = 'revision-tecnica', versiones_archivo = $2::jsonb, historial_estados = $3::jsonb
        WHERE id = $1 RETURNING ${DOC_COLUMNS}`,
      [documentoId, JSON.stringify(versionesArchivo), JSON.stringify(historialEstados)],
    );

    return { documento: updated.rows[0] };
  });
}
