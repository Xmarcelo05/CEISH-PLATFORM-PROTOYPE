// Consultas SQL de notificaciones del motor CEISH.
import type { PoolClient } from 'pg';
import { query } from '../../../lib/database';
import type { Notificacion } from '../../../shared/types/platform.types';

export interface NotificacionRow {
  id: string;
  tipo: Notificacion['tipo'];
  destinatario_id: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
}

/** Notificación aún sin persistir — la arman las acciones que mutan documentos/respuestas. */
export interface NotificacionEvento { destinatarioId: string; mensaje: string }

const COLUMNS = 'id, tipo, destinatario_id, mensaje, leida, created_at';

export async function listNotificaciones(destinatarioId?: string): Promise<NotificacionRow[]> {
  if (destinatarioId) {
    return query<NotificacionRow>(
      `SELECT ${COLUMNS} FROM ceish_notificaciones WHERE destinatario_id = $1 ORDER BY created_at DESC`,
      [destinatarioId],
    );
  }
  return query<NotificacionRow>(`SELECT ${COLUMNS} FROM ceish_notificaciones ORDER BY created_at DESC`);
}

/**
 * Inserta notificaciones dentro de una transacción ya abierta por otra acción
 * (crearDocumento, editarDocumento, emitirAnexo, etc.). Deduplica por
 * destinatario, igual que el helper `buildNotificaciones` del store en
 * memoria del prototipo.
 */
export async function insertNotificaciones(
  client: PoolClient,
  eventos: NotificacionEvento[],
  tipo: Notificacion['tipo'] = 'automatica',
): Promise<NotificacionRow[]> {
  const vistos = new Set<string>();
  const rows: NotificacionRow[] = [];
  for (const evento of eventos) {
    if (!evento.destinatarioId || vistos.has(evento.destinatarioId)) continue;
    vistos.add(evento.destinatarioId);
    const res = await client.query<NotificacionRow>(
      `INSERT INTO ceish_notificaciones (tipo, destinatario_id, mensaje) VALUES ($1,$2,$3) RETURNING ${COLUMNS}`,
      [tipo, evento.destinatarioId, evento.mensaje],
    );
    rows.push(res.rows[0]);
  }
  return rows;
}

export async function enviarNotificacionManual(destinatarioIds: string[], mensaje: string): Promise<NotificacionRow[]> {
  const rows: NotificacionRow[] = [];
  for (const destinatarioId of new Set(destinatarioIds)) {
    const res = await query<NotificacionRow>(
      `INSERT INTO ceish_notificaciones (tipo, destinatario_id, mensaje) VALUES ('manual',$1,$2) RETURNING ${COLUMNS}`,
      [destinatarioId, mensaje],
    );
    rows.push(res[0]);
  }
  return rows;
}

export async function marcarNotificacionLeida(id: string): Promise<NotificacionRow | null> {
  const rows = await query<NotificacionRow>(
    `UPDATE ceish_notificaciones SET leida = TRUE WHERE id = $1 RETURNING ${COLUMNS}`, [id],
  );
  return rows[0] ?? null;
}

export async function marcarTodasLeidas(destinatarioId: string): Promise<NotificacionRow[]> {
  return query<NotificacionRow>(
    `UPDATE ceish_notificaciones SET leida = TRUE WHERE destinatario_id = $1 AND leida = FALSE RETURNING ${COLUMNS}`,
    [destinatarioId],
  );
}
