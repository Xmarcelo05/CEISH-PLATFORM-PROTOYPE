// Consultas SQL de plantillas de anexo del motor CEISH (lado servidor).
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../../lib/database';
import { insertNotificaciones } from './notificaciones';
import type { NotificacionEvento, NotificacionRow } from './notificaciones';
import { stripAnexoFromAllTipos } from './tiposDocumento';
import type { Pregunta } from '../../../shared/types/platform.types';

export interface AnexoTemplateRow {
  id: string;
  numero: number;
  nombre: string;
  rol: 'investigador' | 'evaluador';
  preguntas: Pregunta[];
  word_template_name: string | null;
  word_template_object_key: string | null;
}

export interface AnexoTemplateInput {
  numero: number;
  nombre: string;
  rol: 'investigador' | 'evaluador';
  preguntas: (Omit<Pregunta, 'id'> & { id?: string })[];
  wordTemplateName: string | null;
  wordTemplateObjectKey: string | null;
}

const COLUMNS = 'id, numero, nombre, rol, preguntas, word_template_name, word_template_object_key';

function withPreguntaIds(preguntas: AnexoTemplateInput['preguntas']): Pregunta[] {
  return preguntas.map((p, idx) => ({
    id: p.id || `preg-${randomUUID()}`,
    texto: p.texto,
    tipo: p.tipo,
    descripcionContexto: p.descripcionContexto,
    orden: p.orden ?? idx + 1,
    key: p.key || `tag_${idx + 1}`,
    opciones: p.opciones,
  }));
}

export async function listAnexoTemplates(): Promise<AnexoTemplateRow[]> {
  return query<AnexoTemplateRow>(`SELECT ${COLUMNS} FROM ceish_anexo_templates ORDER BY numero`);
}

export async function createAnexoTemplate(input: AnexoTemplateInput): Promise<AnexoTemplateRow> {
  const id = `anexo-${randomUUID()}`;
  const rows = await query<AnexoTemplateRow>(
    `INSERT INTO ceish_anexo_templates (id, numero, nombre, rol, preguntas, word_template_name, word_template_object_key)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING ${COLUMNS}`,
    [
      id, input.numero, input.nombre, input.rol,
      JSON.stringify(withPreguntaIds(input.preguntas)),
      input.wordTemplateName, input.wordTemplateObjectKey,
    ],
  );
  return rows[0];
}

interface DocumentoActivoRow { id: string; codigo: string; investigador_id: string; tipo_documento_id: string }
interface TipoSeccionesRow { id: string; secciones: { anexos: { anexoTemplateId: string }[] }[] }

/** Documentos no cerrados (aprobada/anulada) cuyo TipoDocumento incluye `anexoTemplateId` en alguna sección. */
async function documentosActivosConAnexo(
  client: PoolClient, anexoTemplateId: string,
): Promise<DocumentoActivoRow[]> {
  const docsRes = await client.query<DocumentoActivoRow>(
    `SELECT id, codigo, investigador_id, tipo_documento_id FROM ceish_documentos WHERE estado NOT IN ('aprobada', 'anulada')`,
  );
  if (docsRes.rows.length === 0) return [];

  const tipoIds = Array.from(new Set(docsRes.rows.map((d) => d.tipo_documento_id)));
  const tiposRes = await client.query<TipoSeccionesRow>(
    `SELECT id, secciones FROM ceish_tipos_documento WHERE id = ANY($1)`, [tipoIds],
  );
  const tiposMap = new Map(tiposRes.rows.map((t) => [t.id, t]));

  return docsRes.rows.filter((d) => {
    const tipo = tiposMap.get(d.tipo_documento_id);
    return tipo?.secciones.some((s) => s.anexos.some((a) => a.anexoTemplateId === anexoTemplateId));
  });
}

/** Notifica a investigador + evaluadores activos de cada documento (usado tras editar/eliminar un anexo). */
async function notificarDocumentos(
  client: PoolClient, docs: DocumentoActivoRow[], mensajePorDoc: (doc: DocumentoActivoRow) => string,
): Promise<NotificacionRow[]> {
  if (docs.length === 0) return [];
  const asigRes = await client.query<{ documento_id: string; evaluador_id: string }>(
    `SELECT documento_id, evaluador_id FROM ceish_asignaciones WHERE documento_id = ANY($1) AND active = TRUE`,
    [docs.map((d) => d.id)],
  );
  const eventos: NotificacionEvento[] = docs.flatMap((d) => {
    const evaluadoresActivos = asigRes.rows.filter((a) => a.documento_id === d.id).map((a) => a.evaluador_id);
    const mensaje = mensajePorDoc(d);
    return [d.investigador_id, ...evaluadoresActivos].map((destinatarioId) => ({ destinatarioId, mensaje }));
  });
  return insertNotificaciones(client, eventos);
}

export interface UpdateAnexoTemplateResult { template: AnexoTemplateRow; notificaciones: NotificacionRow[] }

export async function updateAnexoTemplate(id: string, input: AnexoTemplateInput): Promise<UpdateAnexoTemplateResult | null> {
  return withTransaction(async (client) => {
    const oldRes = await client.query<AnexoTemplateRow>(`SELECT ${COLUMNS} FROM ceish_anexo_templates WHERE id = $1`, [id]);
    const oldTemplate = oldRes.rows[0];
    if (!oldTemplate) return null;

    const nuevasPreguntas = withPreguntaIds(input.preguntas);
    const updated = await client.query<AnexoTemplateRow>(
      `UPDATE ceish_anexo_templates
          SET numero = $2, nombre = $3, rol = $4, preguntas = $5::jsonb,
              word_template_name = $6, word_template_object_key = $7
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [id, input.numero, input.nombre, input.rol, JSON.stringify(nuevasPreguntas), input.wordTemplateName, input.wordTemplateObjectKey],
    );
    const template = updated.rows[0];

    // Reglas de Congelamiento v3 (sección 7 del dominio): solo afecta documentos activos.
    const docsConEsteAnexo = await documentosActivosConAnexo(client, id);

    if (docsConEsteAnexo.length > 0) {
      const respRes = await client.query<{ id: string; valores: { campoId: string }[] }>(
        `SELECT id, valores FROM ceish_respuestas_anexo WHERE documento_id = ANY($1) AND anexo_template_id = $2`,
        [docsConEsteAnexo.map((d) => d.id), id],
      );
      for (const resp of respRes.rows) {
        // Filtrar respuestas a preguntas que fueron eliminadas o cuyo texto cambió
        const valoresFiltrados = resp.valores.filter((val) => {
          const nuevaPreg = nuevasPreguntas.find((p) => p.id === val.campoId);
          const viejaPreg = oldTemplate.preguntas.find((p) => p.id === val.campoId);
          if (!nuevaPreg) return false;
          if (viejaPreg && viejaPreg.texto !== nuevaPreg.texto) return false;
          return true;
        });
        if (valoresFiltrados.length !== resp.valores.length) {
          await client.query(`UPDATE ceish_respuestas_anexo SET valores = $2::jsonb WHERE id = $1`, [
            resp.id, JSON.stringify(valoresFiltrados),
          ]);
        }
      }
    }

    // Notificación (5a): cualquier cambio estructural en las preguntas avisa a
    // investigador + evaluadores activos de TODOS los documentos activos que usan esta plantilla.
    const huboCambioEstructural = oldTemplate.preguntas.length !== nuevasPreguntas.length
      || oldTemplate.preguntas.some((op) => {
        const np = nuevasPreguntas.find((p) => p.id === op.id);
        return !np || np.texto !== op.texto || np.tipo !== op.tipo;
      });

    const notificaciones = huboCambioEstructural
      ? await notificarDocumentos(client, docsConEsteAnexo, (d) =>
        `El Administrador modificó las preguntas del Anexo ${input.numero} (${input.nombre}) en el proyecto ${d.codigo}. Revisa si tus respuestas siguen vigentes.`)
      : [];

    return { template, notificaciones };
  });
}

export interface DeleteAnexoTemplateResult { notificaciones: NotificacionRow[] }

export async function deleteAnexoTemplate(id: string): Promise<DeleteAnexoTemplateResult> {
  return withTransaction(async (client) => {
    const templateRes = await client.query<AnexoTemplateRow>(`SELECT ${COLUMNS} FROM ceish_anexo_templates WHERE id = $1`, [id]);
    const template = templateRes.rows[0];

    const docsConEsteAnexo = await documentosActivosConAnexo(client, id);

    // Limpiar respuestas asociadas a documentos activos y desvincular el anexo de las secciones que lo usaban.
    if (docsConEsteAnexo.length > 0) {
      await client.query(
        `DELETE FROM ceish_respuestas_anexo WHERE documento_id = ANY($1) AND anexo_template_id = $2`,
        [docsConEsteAnexo.map((d) => d.id), id],
      );
    }
    await stripAnexoFromAllTipos(id, client);

    const notificaciones = await notificarDocumentos(client, docsConEsteAnexo, (d) =>
      `El Administrador eliminó el Anexo ${template?.numero ?? ''} (${template?.nombre ?? ''}) del flujo del proyecto ${d.codigo}.`);

    await client.query(`DELETE FROM ceish_anexo_templates WHERE id = $1`, [id]);

    return { notificaciones };
  });
}
