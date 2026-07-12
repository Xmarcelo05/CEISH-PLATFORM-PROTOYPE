// Consultas SQL de respuestas de anexo (borradores + emisiones) y la máquina
// de estados del trámite (emitir anexo, inhibición de revisor) del motor CEISH.
import { query, withTransaction } from '../../../lib/database';
import type { PoolClient } from 'pg';
import type {
  Pregunta, ValorCampo, ComentarioAnotacion, RespuestaAnexo, RiesgoTipo, DocumentoEstado,
} from '../../../shared/types/platform.types';
import type { DocumentoRow } from './documentos';
import { evaluadoresDisponibles } from './documentos';
import { insertNotificaciones } from './notificaciones';
import type { NotificacionEvento, NotificacionRow } from './notificaciones';

export interface RespuestaAnexoRow {
  id: string;
  documento_id: string;
  anexo_template_id: string;
  seccion_id: string;
  version_archivo_id: string;
  emitido_por_id: string;
  emitido_por_nombre: string;
  emitido_at: string;
  resultado: RespuestaAnexo['resultado'];
  valores: ValorCampo[];
  comentarios_anotados: ComentarioAnotacion[];
  snapshot_preguntas: Pregunta[];
}

const RESP_COLUMNS = `id, documento_id, anexo_template_id, seccion_id, version_archivo_id,
  emitido_por_id, emitido_por_nombre, emitido_at, resultado, valores, comentarios_anotados, snapshot_preguntas`;

const DOC_COLUMNS = `id, codigo, tipo_documento_id, tema, descripcion, investigador_id, autores,
  riesgo_declarado, riesgo_confirmado, miembros_ceish_declarados, estado, versiones_archivo,
  historial_estados, cronometro, created_at`;

export async function listRespuestasAnexo(documentoId?: string): Promise<RespuestaAnexoRow[]> {
  if (documentoId) {
    return query<RespuestaAnexoRow>(
      `SELECT ${RESP_COLUMNS} FROM ceish_respuestas_anexo WHERE documento_id = $1`, [documentoId],
    );
  }
  return query<RespuestaAnexoRow>(`SELECT ${RESP_COLUMNS} FROM ceish_respuestas_anexo`);
}

async function upsertRespuesta(
  client: PoolClient,
  input: {
    documentoId: string; anexoTemplateId: string; seccionId: string; versionArchivoId: string;
    emitidoPorId: string; emitidoPorNombre: string; resultado: RespuestaAnexo['resultado'];
    valores: ValorCampo[]; comentariosAnotados: ComentarioAnotacion[];
  },
): Promise<RespuestaAnexoRow> {
  const templateRes = await client.query<{ preguntas: Pregunta[] }>(
    'SELECT preguntas FROM ceish_anexo_templates WHERE id = $1', [input.anexoTemplateId],
  );
  const template = templateRes.rows[0];
  if (!template) throw new Error(`Plantilla de anexo "${input.anexoTemplateId}" no encontrada.`);

  const result = await client.query<RespuestaAnexoRow>(
    `INSERT INTO ceish_respuestas_anexo
       (documento_id, anexo_template_id, seccion_id, version_archivo_id, emitido_por_id, emitido_por_nombre,
        resultado, valores, comentarios_anotados, snapshot_preguntas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb)
     ON CONFLICT (documento_id, anexo_template_id, version_archivo_id) DO UPDATE
       SET emitido_por_id = $5, emitido_por_nombre = $6, resultado = $7,
           valores = $8::jsonb, comentarios_anotados = $9::jsonb, snapshot_preguntas = $10::jsonb, emitido_at = NOW()
     RETURNING ${RESP_COLUMNS}`,
    [
      input.documentoId, input.anexoTemplateId, input.seccionId, input.versionArchivoId,
      input.emitidoPorId, input.emitidoPorNombre, input.resultado,
      JSON.stringify(input.valores), JSON.stringify(input.comentariosAnotados), JSON.stringify(template.preguntas),
    ],
  );
  return result.rows[0];
}

// ── Guardar borrador ─────────────────────────────────────────────────────
export interface GuardarRespuestaInput {
  documentoId: string;
  anexoTemplateId: string;
  seccionId: string;
  versionArchivoId: string;
  emitidoPorId: string;
  emitidoPorNombre: string;
  valores: ValorCampo[];
  comentariosAnotados: ComentarioAnotacion[];
}

export async function guardarRespuestaAnexo(input: GuardarRespuestaInput): Promise<RespuestaAnexoRow> {
  return withTransaction((client) => upsertRespuesta(client, { ...input, resultado: 'coincide' }));
}

// ── Emitir anexo (máquina de estados del trámite) ───────────────────────
export interface EmitirAnexoInput extends GuardarRespuestaInput {
  resultado: RespuestaAnexo['resultado'];
  nuevoEstado: DocumentoEstado;
  cambioComentario?: string;
  nuevoRiesgoConfirmado?: RiesgoTipo;
}

export interface EmitirAnexoResult {
  documento: DocumentoRow;
  respuesta: RespuestaAnexoRow;
  notificaciones: NotificacionRow[];
}

export async function emitirAnexo(input: EmitirAnexoInput): Promise<EmitirAnexoResult> {
  return withTransaction(async (client) => {
    const respuesta = await upsertRespuesta(client, input);

    const docRes = await client.query<DocumentoRow>(`SELECT ${DOC_COLUMNS} FROM ceish_documentos WHERE id = $1`, [input.documentoId]);
    const doc = docRes.rows[0];
    if (!doc) throw new Error('Documento no encontrado.');

    const timestamp = new Date().toISOString();
    const cronometroBase = input.nuevoEstado === 'aprobada'
      ? { fechaAprobacion: timestamp, diasEjecucion: 365 }
      : doc.cronometro;

    // Igual que el mapeo por id literal de 'anexo-27' de abajo (limitación consciente
    // del prototipo): al "No Aprobar" el Anexo 12 se estampa un plazo de 30 días para
    // que el investigador corrija. Se evalúa al vuelo en la UI, no dispara nada solo.
    const cronometro = input.anexoTemplateId === 'anexo-12' && input.resultado === 'con-observaciones'
      ? { ...cronometroBase, fechaLimiteCorreccion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }
      : cronometroBase;

    // COMENTARIO DE CONTROL DE ARQUITECTURA (limitación consciente del prototipo,
    // igual que en el store en memoria): el disparador de 'anexo-27' está mapeado
    // de forma estática por id literal; un TipoDocumento nuevo con otros anexos
    // requeriría programar sus propias transiciones a mano en esta función.
    const riesgoConfirmado = input.anexoTemplateId === 'anexo-27' && input.resultado === 'coincide'
      ? doc.riesgo_declarado
      : (input.nuevoRiesgoConfirmado ?? doc.riesgo_confirmado);

    const historialEstados = [...doc.historial_estados, {
      estado: input.nuevoEstado,
      changedAt: timestamp,
      changedBy: input.emitidoPorNombre,
      comment: input.cambioComentario || `Emisión oficial del Anexo Template (${input.anexoTemplateId})`,
    }];

    const updatedDoc = await client.query<DocumentoRow>(
      `UPDATE ceish_documentos
          SET estado = $2, riesgo_confirmado = $3, cronometro = $4::jsonb, historial_estados = $5::jsonb
        WHERE id = $1
        RETURNING ${DOC_COLUMNS}`,
      [input.documentoId, input.nuevoEstado, riesgoConfirmado, JSON.stringify(cronometro), JSON.stringify(historialEstados)],
    );

    if (input.nuevoEstado === 'aprobada' || input.nuevoEstado === 'anulada') {
      await client.query(`UPDATE ceish_asignaciones SET active = FALSE WHERE documento_id = $1`, [input.documentoId]);
    }

    const estadoAnterior = doc.estado;
    const eventos: NotificacionEvento[] = [];
    if (input.nuevoEstado === 'aprobada' && estadoAnterior !== 'aprobada') {
      eventos.push({
        destinatarioId: doc.investigador_id,
        mensaje: `Tu proyecto ${doc.codigo} ha sido aprobado ética y metodológicamente.`,
      });
    }
    if (input.resultado === 'con-observaciones') {
      eventos.push({
        destinatarioId: doc.investigador_id,
        mensaje: `Se registraron observaciones en tu proyecto ${doc.codigo}.` + (input.cambioComentario ? ` ${input.cambioComentario}` : ''),
      });
    }
    if (input.nuevoEstado === 'creada' && estadoAnterior !== 'creada') {
      eventos.push({
        destinatarioId: doc.investigador_id,
        mensaje: `Tu proyecto ${doc.codigo} fue regresado para corrección.` + (input.cambioComentario ? ` ${input.cambioComentario}` : ''),
      });
    }
    if (
      input.nuevoEstado !== estadoAnterior
      && input.nuevoEstado !== 'aprobada'
      && input.nuevoEstado !== 'creada'
      && input.nuevoEstado !== 'anulada'
    ) {
      eventos.push({
        destinatarioId: doc.investigador_id,
        mensaje: `Tu proyecto ${doc.codigo} avanzó a la etapa: ${input.nuevoEstado}.`,
      });
    }

    const notificaciones = await insertNotificaciones(client, eventos);
    return { documento: updatedDoc.rows[0], respuesta, notificaciones };
  });
}

// ── Inhibición del evaluador por conflicto de interés (Anexo 23) ────────
export interface DarseDeBajaRevisorResult {
  documento: DocumentoRow;
  notificaciones: NotificacionRow[];
}

export async function darseDeBajaRevisor(
  documentoId: string,
  evaluadorId: string,
  evaluadorNombre: string,
  comentarioConflicto: string,
): Promise<DarseDeBajaRevisorResult> {
  return withTransaction(async (client) => {
    const docRes = await client.query<DocumentoRow>(`SELECT ${DOC_COLUMNS} FROM ceish_documentos WHERE id = $1`, [documentoId]);
    const doc = docRes.rows[0];
    if (!doc) throw new Error('Documento no encontrado.');

    const timestamp = new Date().toISOString();
    const latestVersionId = doc.versiones_archivo[doc.versiones_archivo.length - 1]?.id ?? '';

    // La reasignación debe quedarse en la MISMA etapa/sección del evaluador que
    // se inhibe — una recusación no es un avance de trámite.
    const asigActualRes = await client.query<{ seccion_id: string }>(
      `SELECT seccion_id FROM ceish_asignaciones WHERE documento_id = $1 AND evaluador_id = $2 AND active = TRUE`,
      [documentoId, evaluadorId],
    );
    const seccionIdActual = asigActualRes.rows[0]?.seccion_id ?? 'sec-estratificacion';

    const respuesta = await upsertRespuesta(client, {
      documentoId,
      anexoTemplateId: 'anexo-23',
      seccionId: 'sec-estratificacion',
      versionArchivoId: latestVersionId,
      emitidoPorId: evaluadorId,
      emitidoPorNombre: evaluadorNombre,
      resultado: 'conflicto-interes',
      valores: [
        { campoId: 'a23_c1', valor: comentarioConflicto },
        { campoId: 'a23_c2', valor: true },
      ],
      comentariosAnotados: [],
    });

    await client.query(
      `UPDATE ceish_asignaciones
          SET active = FALSE, baja_motivo = 'Inhibición declarada (Anexo 23).', baja_anexo_id = $3
        WHERE documento_id = $1 AND evaluador_id = $2 AND active = TRUE`,
      [documentoId, evaluadorId, respuesta.id],
    );

    const exclusiones = Array.from(new Set([...doc.miembros_ceish_declarados, evaluadorId]));

    const evaluadoresRes = await client.query<{ id: string; name: string }>(
      `SELECT u.id, u.name FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'teacher'`,
    );
    const disponibles = evaluadoresRes.rows.filter((e) => e.id !== evaluadorId && !exclusiones.includes(e.id));

    const adminRes = await client.query<{ id: string }>(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin'`,
    );

    const eventos: NotificacionEvento[] = adminRes.rows.map((a) => ({
      destinatarioId: a.id,
      mensaje: `El evaluador ${evaluadorNombre} declaró conflicto de interés en el proyecto ${doc.codigo}.`,
    }));

    let comentarioHistorial = 'El revisor se inhibió del proceso por conflicto de interés (Anexo 23).';
    if (disponibles.length > 0) {
      const nuevoEvaluador = disponibles[Math.floor(Math.random() * disponibles.length)];
      await client.query(
        `INSERT INTO ceish_asignaciones (documento_id, seccion_id, evaluador_id, active, assigned_at)
         VALUES ($1,$4,$2,TRUE,$3)`,
        [documentoId, nuevoEvaluador.id, timestamp, seccionIdActual],
      );
      comentarioHistorial += ` Reasignado automáticamente al revisor: ${nuevoEvaluador.name} para continuar la misma etapa.`;
      eventos.push({
        destinatarioId: nuevoEvaluador.id,
        mensaje: `Se te ha asignado el proyecto ${doc.codigo} para evaluación técnica.`,
      });
    } else {
      comentarioHistorial += ' No existen más revisores disponibles en la plataforma.';
    }

    const historialEstados = [...doc.historial_estados, {
      estado: doc.estado,
      changedAt: timestamp,
      changedBy: evaluadorNombre,
      comment: comentarioHistorial,
    }];

    const updated = await client.query<DocumentoRow>(
      `UPDATE ceish_documentos
          SET miembros_ceish_declarados = $2::jsonb, historial_estados = $3::jsonb
        WHERE id = $1
        RETURNING ${DOC_COLUMNS}`,
      [documentoId, JSON.stringify(exclusiones), JSON.stringify(historialEstados)],
    );

    const notificaciones = await insertNotificaciones(client, eventos);
    return { documento: updated.rows[0], notificaciones };
  });
}

// ── Elevar riesgo en Estratificación → Revisión Técnica con 2 evaluadores ──
export interface ElevarRiesgoResult {
  documento: DocumentoRow;
  notificaciones: NotificacionRow[];
}

export async function elevarRiesgoTecnica(
  documentoId: string,
  evaluadorId: string,
  evaluadorNombre: string,
  nuevoRiesgoConfirmado: RiesgoTipo,
  justificacion: string,
): Promise<ElevarRiesgoResult> {
  return withTransaction(async (client) => {
    const docRes = await client.query<DocumentoRow>(`SELECT ${DOC_COLUMNS} FROM ceish_documentos WHERE id = $1`, [documentoId]);
    const doc = docRes.rows[0];
    if (!doc) throw new Error('Documento no encontrado.');

    const timestamp = new Date().toISOString();
    const latestVersionId = doc.versiones_archivo[doc.versiones_archivo.length - 1]?.id ?? '';

    await upsertRespuesta(client, {
      documentoId,
      anexoTemplateId: 'anexo-27',
      seccionId: 'sec-estratificacion',
      versionArchivoId: latestVersionId,
      emitidoPorId: evaluadorId,
      emitidoPorNombre: evaluadorNombre,
      resultado: 'discrepa',
      valores: [{ campoId: 'justificacion_riesgo', valor: justificacion }],
      comentariosAnotados: [],
    });

    // Cierra la asignación de Estratificación y busca 2 evaluadores frescos para
    // Revisión Técnica (excluyendo también al evaluador de Estratificación, para
    // mantener ojos distintos entre etapas).
    await client.query(
      `UPDATE ceish_asignaciones SET active = FALSE WHERE documento_id = $1 AND active = TRUE`,
      [documentoId],
    );

    const { disponibles, exclusiones } = await evaluadoresDisponibles(client, doc.autores, doc.miembros_ceish_declarados);
    const candidatos = disponibles.filter((e) => e.id !== evaluadorId);
    const elegidos: typeof candidatos = [];
    const pool = [...candidatos];
    while (elegidos.length < 2 && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      elegidos.push(pool[idx]);
      pool.splice(idx, 1);
    }

    let comentarioHistorial = `Riesgo reclasificado a ${nuevoRiesgoConfirmado.replace('-', ' ')}. Proyecto pasa a Revisión Técnica.`;
    const eventos: NotificacionEvento[] = [
      { destinatarioId: doc.investigador_id, mensaje: `Tu proyecto ${doc.codigo} pasó a Revisión Técnica tras la estratificación de riesgo.` },
    ];

    if (elegidos.length > 0) {
      for (const evaluador of elegidos) {
        await client.query(
          `INSERT INTO ceish_asignaciones (documento_id, seccion_id, evaluador_id, active, assigned_at)
           VALUES ($1,'sec-evaluacion',$2,TRUE,$3)`,
          [documentoId, evaluador.id, timestamp],
        );
        eventos.push({
          destinatarioId: evaluador.id,
          mensaje: `Se te ha asignado el proyecto ${doc.codigo} para evaluación técnica.`,
        });
      }
      comentarioHistorial += ` Asignados ${elegidos.length} evaluador(es) para revisión técnica.`;
    } else {
      comentarioHistorial += ' No existen evaluadores disponibles en la plataforma.';
    }

    const historialEstados = [...doc.historial_estados, {
      estado: 'revision-tecnica' as DocumentoEstado,
      changedAt: timestamp,
      changedBy: evaluadorNombre,
      comment: comentarioHistorial,
    }];

    const updated = await client.query<DocumentoRow>(
      `UPDATE ceish_documentos
          SET estado = 'revision-tecnica', riesgo_confirmado = $2, miembros_ceish_declarados = $3::jsonb, historial_estados = $4::jsonb
        WHERE id = $1
        RETURNING ${DOC_COLUMNS}`,
      [documentoId, nuevoRiesgoConfirmado, JSON.stringify(Array.from(exclusiones)), JSON.stringify(historialEstados)],
    );

    const notificaciones = await insertNotificaciones(client, eventos);
    return { documento: updated.rows[0], notificaciones };
  });
}
