// Consultas SQL de escalamientos del motor CEISH.
import { query, withTransaction } from '../../../lib/database';
import { insertNotificaciones } from './notificaciones';
import type { NotificacionRow } from './notificaciones';

export interface EscalamientoRow {
  id: string;
  respuesta_anexo_id: string | null;
  documento_id: string;
  seccion_id: string;
  anexo_template_id: string;
  comentario_evaluador: string;
  estado: 'pendiente' | 'resuelto';
  edicion_admin: string | null;
  notificado: boolean;
  created_at: string;
}

const COLUMNS = `id, respuesta_anexo_id, documento_id, seccion_id, anexo_template_id,
  comentario_evaluador, estado, edicion_admin, notificado, created_at`;

export async function listEscalamientos(estado?: 'pendiente' | 'resuelto'): Promise<EscalamientoRow[]> {
  if (estado) {
    return query<EscalamientoRow>(
      `SELECT ${COLUMNS} FROM ceish_escalamientos WHERE estado = $1 ORDER BY created_at DESC`, [estado],
    );
  }
  return query<EscalamientoRow>(`SELECT ${COLUMNS} FROM ceish_escalamientos ORDER BY created_at DESC`);
}

export interface CrearEscalamientoResult { escalamiento: EscalamientoRow; notificaciones: NotificacionRow[] }

export async function crearEscalamiento(
  documentoId: string,
  seccionId: string,
  anexoTemplateId: string,
  comentarioEvaluador: string,
  respuestaAnexoId: string | null,
): Promise<CrearEscalamientoResult> {
  return withTransaction(async (client) => {
    const docRes = await client.query<{ codigo: string }>('SELECT codigo FROM ceish_documentos WHERE id = $1', [documentoId]);
    const codigo = docRes.rows[0]?.codigo ?? documentoId;

    const inserted = await client.query<EscalamientoRow>(
      `INSERT INTO ceish_escalamientos (respuesta_anexo_id, documento_id, seccion_id, anexo_template_id, comentario_evaluador, estado, notificado)
       VALUES ($1,$2,$3,$4,$5,'pendiente',FALSE)
       RETURNING ${COLUMNS}`,
      [respuestaAnexoId || null, documentoId, seccionId, anexoTemplateId, comentarioEvaluador],
    );
    const escalamiento = inserted.rows[0];

    const adminRes = await client.query<{ id: string }>(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin'`,
    );
    const notificaciones = await insertNotificaciones(
      client,
      adminRes.rows.map((a) => ({
        destinatarioId: a.id,
        mensaje: `Se escaló una situación del proyecto ${codigo} que requiere tu resolución.`,
      })),
    );

    return { escalamiento, notificaciones };
  });
}

export async function resolverEscalamiento(id: string, edicionAdmin: string): Promise<EscalamientoRow | null> {
  const rows = await query<EscalamientoRow>(
    `UPDATE ceish_escalamientos SET estado = 'resuelto', edicion_admin = $2, notificado = TRUE WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, edicionAdmin],
  );
  return rows[0] ?? null;
}
