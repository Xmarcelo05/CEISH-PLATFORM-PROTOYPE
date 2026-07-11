// Reinicio de los datos operativos de demo del motor CEISH (solo desarrollo).
// Deliberadamente NO toca ceish_anexo_templates / ceish_tipos_documento: esos
// son configuración del administrador, no "datos de prueba" desechables — un
// reset del prototipo no debería borrar plantillas que alguien configuró.
import { withTransaction } from '../../../lib/database';

export async function resetDemoData(): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `TRUNCATE ceish_notificaciones, ceish_escalamientos, ceish_respuestas_anexo, ceish_asignaciones, ceish_documentos`,
    );

    await client.query(
      `INSERT INTO ceish_documentos (
         id, codigo, tipo_documento_id, tema, descripcion, investigador_id, autores,
         riesgo_declarado, miembros_ceish_declarados, estado, versiones_archivo, historial_estados, created_at
       ) VALUES (
         'c1000000-0000-0000-0000-000000000001',
         'CEISH-2026-0001',
         'tipo-investigacion',
         'Uso de pantallas y desarrollo lingüístico en infantes',
         'Análisis descriptivo del impacto del tiempo frente a pantallas en el vocabulario expresivo en niños de 2 a 4 años.',
         'c0000000-0000-0000-0000-000000000001',
         '[
           {"cedula": "2000000001", "nombre": "Juan Pérez"},
           {"cedula": "9999999999", "nombre": "Dra. María Andrade"}
         ]'::jsonb,
         'sin-riesgo', '[]'::jsonb, 'creada',
         jsonb_build_array(jsonb_build_object(
           'id', 'ver-seed-001', 'documentName', 'Protocolo_Pantallas_V1.pdf',
           'documentPath', 'mock/seed-proyecto-final-juan.pdf',
           'comment', 'Documento inicial para revisión.', 'uploadedAt', (NOW() - INTERVAL '4 days')
         )),
         jsonb_build_array(jsonb_build_object(
           'estado', 'creada', 'changedAt', (NOW() - INTERVAL '4 days'),
           'changedBy', 'Juan Pérez', 'comment', 'Proyecto registrado en la plataforma.'
         )),
         NOW() - INTERVAL '4 days'
       )`,
    );

    await client.query(
      `INSERT INTO ceish_documentos (
         id, codigo, tipo_documento_id, tema, descripcion, investigador_id, autores,
         riesgo_declarado, miembros_ceish_declarados, estado, versiones_archivo, historial_estados, created_at
       ) VALUES (
         'c1000000-0000-0000-0000-000000000002',
         'CEISH-2026-0002',
         'tipo-investigacion',
         'Percepción docente sobre la educación inclusiva',
         'Estudio de encuesta para medir actitudes y barreras percibidas por docentes de secundaria ante la inclusión educativa.',
         'c0000000-0000-0000-0000-000000000002',
         '[{"cedula": "2000000002", "nombre": "María López"}]'::jsonb,
         'sin-riesgo', '[]'::jsonb, 'estratificacion',
         jsonb_build_array(jsonb_build_object(
           'id', 'ver-seed-002', 'documentName', 'Protocolo_Inclusion_Final.pdf',
           'documentPath', 'mock/seed-proyecto-final-juan.pdf',
           'comment', 'Se solicita revisión de exención ética.', 'uploadedAt', (NOW() - INTERVAL '2 days')
         )),
         jsonb_build_array(
           jsonb_build_object('estado', 'creada', 'changedAt', (NOW() - INTERVAL '2 days'), 'changedBy', 'María López', 'comment', 'Registro del proyecto.'),
           jsonb_build_object('estado', 'estratificacion', 'changedAt', (NOW() - INTERVAL '2 days'), 'changedBy', 'María López', 'comment', 'Revisión solicitada formalmente.')
         ),
         NOW() - INTERVAL '2 days'
       )`,
    );

    await client.query(
      `INSERT INTO ceish_asignaciones (documento_id, seccion_id, evaluador_id, active, assigned_at)
       VALUES ('c1000000-0000-0000-0000-000000000002', 'sec-estratificacion', 'b0000000-0000-0000-0000-000000000001', TRUE, NOW() - INTERVAL '2 days')`,
    );

    // Los 2 documentos de arriba usan códigos escritos a mano; adelantamos la secuencia (mismo criterio que seed.sql).
    await client.query(`SELECT setval('ceish_documento_codigo_seq', 2)`);
  });
}
