// Consultas SQL de tipos de documento (flujos configurables) del motor CEISH.
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query } from '../../../lib/database';
import type { Seccion, AnexoAsignado } from '../../../shared/types/platform.types';

export interface TipoDocumentoRow {
  id: string;
  nombre: string;
  secciones: Seccion[];
}

export interface SeccionInput {
  id?: string;
  nombre: string;
  orden: number;
  anexos: AnexoAsignado[];
}

function withSeccionIds(secciones: SeccionInput[]): Seccion[] {
  return secciones.map((s, idx) => ({
    id: s.id || `sec-${randomUUID()}`,
    nombre: s.nombre,
    orden: s.orden ?? idx + 1,
    anexos: s.anexos,
  }));
}

export async function listTiposDocumento(): Promise<TipoDocumentoRow[]> {
  return query<TipoDocumentoRow>(`SELECT id, nombre, secciones FROM ceish_tipos_documento ORDER BY nombre`);
}

export async function createTipoDocumento(nombre: string, secciones: SeccionInput[]): Promise<TipoDocumentoRow> {
  const id = `tipo-doc-${randomUUID()}`;
  const rows = await query<TipoDocumentoRow>(
    `INSERT INTO ceish_tipos_documento (id, nombre, secciones) VALUES ($1, $2, $3::jsonb)
     RETURNING id, nombre, secciones`,
    [id, nombre, JSON.stringify(withSeccionIds(secciones))],
  );
  return rows[0];
}

export async function updateTipoDocumento(
  id: string, nombre: string, secciones: SeccionInput[],
): Promise<TipoDocumentoRow | null> {
  const rows = await query<TipoDocumentoRow>(
    `UPDATE ceish_tipos_documento SET nombre = $2, secciones = $3::jsonb WHERE id = $1
     RETURNING id, nombre, secciones`,
    [id, nombre, JSON.stringify(withSeccionIds(secciones))],
  );
  return rows[0] ?? null;
}

export async function deleteTipoDocumento(id: string): Promise<void> {
  await query(`DELETE FROM ceish_tipos_documento WHERE id = $1`, [id]);
}

/**
 * Quita un anexoTemplateId de las secciones de todos los tipos de documento
 * (al borrar esa plantilla). Acepta un `client` opcional para participar en
 * la transacción de quien llama (p. ej. deleteAnexoTemplate).
 */
export async function stripAnexoFromAllTipos(anexoTemplateId: string, client?: PoolClient): Promise<void> {
  const selectSql = `SELECT id, nombre, secciones FROM ceish_tipos_documento ORDER BY nombre`;
  const tipos = client
    ? (await client.query<TipoDocumentoRow>(selectSql)).rows
    : await query<TipoDocumentoRow>(selectSql);

  for (const tipo of tipos) {
    const nuevasSecciones = tipo.secciones.map((sec) => ({
      ...sec,
      anexos: sec.anexos
        .filter((a) => a.anexoTemplateId !== anexoTemplateId)
        .map((a) => a.requiereAnexoIds?.includes(anexoTemplateId)
          ? { ...a, requiereAnexoIds: a.requiereAnexoIds.filter((id) => id !== anexoTemplateId) }
          : a),
    }));
    if (JSON.stringify(nuevasSecciones) !== JSON.stringify(tipo.secciones)) {
      const updateSql = `UPDATE ceish_tipos_documento SET secciones = $2::jsonb WHERE id = $1`;
      const params = [tipo.id, JSON.stringify(nuevasSecciones)];
      if (client) await client.query(updateSql, params);
      else await query(updateSql, params);
    }
  }
}
