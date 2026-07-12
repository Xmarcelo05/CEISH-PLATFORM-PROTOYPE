-- ============================================================================
-- CEISH Platform — Datos de prueba (seed)
-- Se ejecuta después de schema.sql al crear el contenedor.
-- Usa UUIDs fijos para que las relaciones sean legibles y reproducibles.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- roles
-- ----------------------------------------------------------------------------
INSERT INTO roles (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'student'),
  ('22222222-2222-2222-2222-222222222222', 'teacher'),
  ('33333333-3333-3333-3333-333333333333', 'admin');

-- ----------------------------------------------------------------------------
-- users  (contraseña en texto plano: solo para el prototipo)
-- ----------------------------------------------------------------------------
INSERT INTO users (id, name, email, password, role_id, cedula) VALUES
  -- admin demo
  ('a0000000-0000-0000-0000-000000000001', 'Admin Demo',   'admin@ceish.edu',   'demo123', '33333333-3333-3333-3333-333333333333', '1000000001'),
  -- profesor demo
  ('b0000000-0000-0000-0000-000000000001', 'Profesor Demo','profesor@ceish.edu','demo123', '22222222-2222-2222-2222-222222222222', '1000000002'),
  -- evaluadores adicionales
  ('b0000000-0000-0000-0000-000000000002', 'Evaluador Alterno CEISH', 'alterno@ceish.edu', 'demo123', '22222222-2222-2222-2222-222222222222', '1000000003'),
  ('b0000000-0000-0000-0000-000000000003', 'Dr. Roberto Anchundia', 'roberto@ceish.edu', 'demo123', '22222222-2222-2222-2222-222222222222', '1000000004'),
  -- estudiantes demo
  ('c0000000-0000-0000-0000-000000000001', 'Juan Pérez',   'juan@ceish.edu',    'demo123', '11111111-1111-1111-1111-111111111111', '2000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'María López',  'maria@ceish.edu',   'demo123', '11111111-1111-1111-1111-111111111111', '2000000002'),
  ('c0000000-0000-0000-0000-000000000003', 'Carlos Ruiz',  'carlos@ceish.edu',  'demo123', '11111111-1111-1111-1111-111111111111', '2000000003');

-- ----------------------------------------------------------------------------
-- assignments  (el profesor demo tiene 3 estudiantes asignados)
-- ----------------------------------------------------------------------------
INSERT INTO assignments (teacher_id, student_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003');

-- ----------------------------------------------------------------------------
-- submissions  (Juan tiene una entrega en revisión)
-- ----------------------------------------------------------------------------
-- Nota: el document_path apunta a un objeto de ejemplo que no existe físicamente
-- en MinIO. Para una visualización real, sube un PDF nuevo desde la interfaz.
INSERT INTO submissions (id, student_id, document_name, document_path, comment, status, submitted_at) VALUES
  ('d0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'Proyecto_Final_Juan.pdf',
   'documents/seed-proyecto-final-juan.pdf',
   'Primera versión del proyecto de investigación.',
   'submitted',
   NOW() - INTERVAL '3 days');

-- ----------------------------------------------------------------------------
-- reviews  (el profesor demo revisa la entrega de Juan)
-- ----------------------------------------------------------------------------
INSERT INTO reviews (id, submission_id, reviewer_id, comment, status) VALUES
  ('e0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   '',
   'in-progress');

-- ----------------------------------------------------------------------------
-- review_stages  (4 etapas; la 1 completa, la 2 en progreso, 3 y 4 pendientes)
-- ----------------------------------------------------------------------------
INSERT INTO review_stages (id, review_id, stage_number, status, completed_at) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'completed',   NOW() - INTERVAL '1 day'),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 2, 'in-progress', NULL),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 3, 'pending',     NULL),
  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 4, 'pending',     NULL);

-- ----------------------------------------------------------------------------
-- criteria_evaluations  (criterios de la etapa 1, ya evaluados)
-- ----------------------------------------------------------------------------
INSERT INTO criteria_evaluations (id, stage_id, criterion, status, comment) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-000000000001', 'El documento contiene una introducción clara', 'approved', 'Introducción bien planteada.'),
  ('00000000-0000-0000-0000-0000000000a2', 'f0000000-0000-0000-0000-000000000001', 'Los objetivos están claramente definidos',    'approved', ''),
  ('00000000-0000-0000-0000-0000000000a3', 'f0000000-0000-0000-0000-000000000001', 'La hipótesis o pregunta de investigación está planteada', 'rejected', 'Falta precisar la hipótesis.'),
  -- criterios de la etapa 2 (en progreso, aún pendientes)
  ('00000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-000000000002', 'La metodología es apropiada para el tipo de investigación', 'pending', ''),
  ('00000000-0000-0000-0000-0000000000b2', 'f0000000-0000-0000-0000-000000000002', 'La población de estudio está correctamente definida',       'pending', '');

-- ----------------------------------------------------------------------------
-- annotations  (una marca sobre el PDF para el criterio rechazado)
-- ----------------------------------------------------------------------------
INSERT INTO annotations (criteria_evaluation_id, page_number, x, y, width, height, comment) VALUES
  ('00000000-0000-0000-0000-0000000000a3', 2, 15.5, 42.0, 60.0, 8.5, 'Aquí debería ir la hipótesis explícita.');

-- ============================================================================
-- Motor CEISH v3 — Etapa 1: seed de configuración (flujo "Investigación")
-- Nota: word_template_object_key queda en NULL a propósito. Igual que el PDF
-- de ejemplo de "submissions" de arriba, no existe físicamente en MinIO; sube
-- una plantilla .docx real desde el panel de administración (Anexos) tras
-- levantar el entorno.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ceish_anexo_templates  (9 del investigador + 6 del evaluador)
-- ----------------------------------------------------------------------------
INSERT INTO ceish_anexo_templates (id, numero, nombre, rol, preguntas) VALUES
  ('anexo-1', 1, 'Solicitud de Revisión Técnica', 'investigador', '[
    {"id": "preg-anexo1-1", "texto": "Título descriptivo del proyecto de investigación", "tipo": "texto-libre", "orden": 1, "key": "tema"},
    {"id": "preg-anexo1-2", "texto": "Breve justificación e hipótesis de trabajo", "tipo": "texto-libre", "orden": 2, "key": "observaciones"}
  ]'::jsonb),
  ('anexo-2', 2, 'Anexo 2 Formulario de Ficha Ética', 'investigador', '[
    {"id": "preg-anexo2-1", "texto": "Pregunta declaratoria de cumplimiento Anexo 2", "tipo": "checklist", "orden": 1, "key": "cumplimiento_anexo_2"}
  ]'::jsonb),
  ('anexo-3', 3, 'Anexo 3 Formulario de Ficha Ética', 'investigador', '[
    {"id": "preg-anexo3-1", "texto": "Pregunta declaratoria de cumplimiento Anexo 3", "tipo": "checklist", "orden": 1, "key": "cumplimiento_anexo_3"}
  ]'::jsonb),
  ('anexo-4', 4, 'Anexo 4 Formulario de Ficha Ética', 'investigador', '[
    {"id": "preg-anexo4-1", "texto": "Pregunta declaratoria de cumplimiento Anexo 4", "tipo": "checklist", "orden": 1, "key": "cumplimiento_anexo_4"}
  ]'::jsonb),
  ('anexo-5', 5, 'Anexo 5 Formulario de Ficha Ética', 'investigador', '[
    {"id": "preg-anexo5-1", "texto": "Pregunta declaratoria de cumplimiento Anexo 5", "tipo": "checklist", "orden": 1, "key": "cumplimiento_anexo_5"}
  ]'::jsonb),
  ('anexo-6', 6, 'Anexo 6 Formulario de Ficha Ética', 'investigador', '[
    {"id": "preg-anexo6-1", "texto": "Pregunta declaratoria de cumplimiento Anexo 6", "tipo": "checklist", "orden": 1, "key": "cumplimiento_anexo_6"}
  ]'::jsonb),
  ('anexo-7', 7, 'Anexo 7 Formulario de Ficha Ética', 'investigador', '[
    {"id": "preg-anexo7-1", "texto": "Pregunta declaratoria de cumplimiento Anexo 7", "tipo": "checklist", "orden": 1, "key": "cumplimiento_anexo_7"}
  ]'::jsonb),
  ('anexo-8', 8, 'Anexo 8 Formulario de Ficha Ética', 'investigador', '[
    {"id": "preg-anexo8-1", "texto": "Pregunta declaratoria de cumplimiento Anexo 8", "tipo": "checklist", "orden": 1, "key": "cumplimiento_anexo_8"}
  ]'::jsonb),
  ('anexo-9', 9, 'Anexo 9 Formulario de Ficha Ética', 'investigador', '[
    {"id": "preg-anexo9-1", "texto": "Pregunta declaratoria de cumplimiento Anexo 9", "tipo": "checklist", "orden": 1, "key": "cumplimiento_anexo_9"}
  ]'::jsonb),
  ('anexo-27', 27, 'Formato para Estratificación de Riesgos', 'evaluador', '[
    {"id": "preg-anexo27-1", "texto": "1. ¿La investigación involucra procedimientos que puedan causar daño físico o psicológico directo al sujeto?", "tipo": "checklist", "orden": 1, "key": "procedimientos_riesgo"},
    {"id": "preg-anexo27-2", "texto": "2. ¿Se recolectan datos personales sensibles o información privada de carácter confidencial?", "tipo": "checklist", "orden": 2, "key": "datos_sensibles"},
    {"id": "preg-anexo27-3", "texto": "3. ¿Se utilizan muestras biológicas humanas (sangre, tejidos, fluidos)?", "tipo": "checklist", "orden": 3, "key": "muestras_biologicas"},
    {"id": "preg-anexo27-4", "texto": "4. ¿Involucra poblaciones vulnerables (niños, personas con discapacidad, etc.)?", "tipo": "checklist", "orden": 4, "key": "poblaciones_vulnerables"},
    {"id": "preg-anexo27-5", "texto": "Justificación / Criterio final del revisor", "tipo": "texto-libre", "orden": 5, "key": "observaciones"}
  ]'::jsonb),
  ('anexo-11', 11, 'Formato de Carta de Exención (Sin Riesgo)', 'evaluador', '[
    {"id": "preg-anexo11-1", "texto": "Justificación técnica del cumplimiento de criterios de exención ética", "tipo": "texto-libre", "orden": 1, "key": "observaciones"},
    {"id": "preg-anexo11-2", "texto": "Declaración formal de exención de revisión por el comité CEISH", "tipo": "checklist", "orden": 2, "key": "declaracion_exencion"}
  ]'::jsonb),
  ('anexo-23', 23, 'Declaración de Conflicto de Intereses', 'evaluador', '[
    {"id": "preg-anexo23-1", "texto": "Describa detalladamente la causa de su conflicto de interés con el proyecto o sus autores", "tipo": "texto-libre", "orden": 1, "key": "observaciones"},
    {"id": "preg-anexo23-2", "texto": "Declaración juramentada de inhibición en el proceso de evaluación", "tipo": "checklist", "orden": 2, "key": "declaracion_inhibicion"}
  ]'::jsonb),
  ('anexo-12', 12, 'Check List de Evaluación de Proyecto', 'evaluador', '[
    {"id": "preg-anexo12-1", "texto": "A. Título de la investigación descriptivo y delimitado", "tipo": "checklist", "orden": 1, "key": "titulo_valido"},
    {"id": "preg-anexo12-2", "texto": "B. Justificación teórica y empírica del problema de investigación", "tipo": "checklist", "orden": 2, "key": "justificacion_valida"},
    {"id": "preg-anexo12-3", "texto": "C. Objetivos específicos coherentes con el objetivo general", "tipo": "checklist", "orden": 3, "key": "objetivos_coherentes"},
    {"id": "preg-anexo12-4", "texto": "D. Diseño metodológico adecuado y detallado", "tipo": "checklist", "orden": 4, "key": "diseno_metodologico"},
    {"id": "preg-anexo12-5", "texto": "E. Consideraciones éticas aplicables debidamente fundamentadas", "tipo": "checklist", "orden": 5, "key": "consideraciones_eticas"},
    {"id": "preg-anexo12-6", "texto": "F. Observaciones generales detalladas", "tipo": "texto-libre", "orden": 6, "key": "observaciones"}
  ]'::jsonb),
  ('anexo-13', 13, 'Formato para emisión de resoluciones de aprobación', 'evaluador', '[
    {"id": "preg-anexo13-1", "texto": "Declaración formal de Aprobación Ética y Metodológica", "tipo": "checklist", "orden": 1, "key": "declaracion_aprobacion"},
    {"id": "preg-anexo13-2", "texto": "Términos y condiciones de la aprobación del proyecto", "tipo": "texto-libre", "orden": 2, "key": "observaciones"}
  ]'::jsonb),
  ('anexo-26', 26, 'Resolución de suspensión o revocatoria', 'evaluador', '[
    {"id": "preg-anexo26-1", "texto": "Motivos de la suspensión/revocatoria (vencimiento de plazos, faltas éticas, etc.)", "tipo": "texto-libre", "orden": 1, "key": "observaciones"},
    {"id": "preg-anexo26-2", "texto": "Declaración formal de suspensión de la validez del certificado aprobatorio", "tipo": "checklist", "orden": 2, "key": "declaracion_suspension"}
  ]'::jsonb);

-- ----------------------------------------------------------------------------
-- ceish_tipos_documento  (flujo semilla "Investigación": 3 etapas)
-- ----------------------------------------------------------------------------
INSERT INTO ceish_tipos_documento (id, nombre, secciones) VALUES
  ('tipo-investigacion', 'Investigación', '[
    {
      "id": "sec-creacion",
      "nombre": "Etapa 1: Creación de Investigación",
      "orden": 1,
      "anexos": [
        {"anexoTemplateId": "anexo-1", "obligatorio": true},
        {"anexoTemplateId": "anexo-2", "obligatorio": true},
        {"anexoTemplateId": "anexo-3", "obligatorio": true},
        {"anexoTemplateId": "anexo-4", "obligatorio": true},
        {"anexoTemplateId": "anexo-5", "obligatorio": true},
        {"anexoTemplateId": "anexo-6", "obligatorio": true},
        {"anexoTemplateId": "anexo-7", "obligatorio": true},
        {"anexoTemplateId": "anexo-8", "obligatorio": true},
        {"anexoTemplateId": "anexo-9", "obligatorio": true}
      ]
    },
    {
      "id": "sec-estratificacion",
      "nombre": "Etapa 2: Estratificación",
      "orden": 2,
      "anexos": [
        {"anexoTemplateId": "anexo-27", "obligatorio": true},
        {"anexoTemplateId": "anexo-11", "obligatorio": true, "requiereAnexoIds": ["anexo-27"]},
        {"anexoTemplateId": "anexo-23", "obligatorio": false, "requiereAnexoIds": ["anexo-11"]}
      ]
    },
    {
      "id": "sec-evaluacion",
      "nombre": "Etapa 3: Evaluación",
      "orden": 3,
      "anexos": [
        {"anexoTemplateId": "anexo-12", "obligatorio": true},
        {"anexoTemplateId": "anexo-13", "obligatorio": true, "requiereAnexoIds": ["anexo-12"]},
        {"anexoTemplateId": "anexo-26", "obligatorio": false}
      ]
    }
  ]'::jsonb);

-- ============================================================================
-- Motor CEISH v3 — Etapa 2: trámites (documentos) y asignaciones de ejemplo
-- Nota: documentPath apunta a un objeto mock que no existe en MinIO (mismo
-- criterio que "submissions" arriba); sube un PDF real desde la interfaz.
-- ============================================================================

INSERT INTO ceish_documentos (
  id, codigo, tipo_documento_id, tema, descripcion, investigador_id, autores,
  riesgo_declarado, miembros_ceish_declarados, estado, versiones_archivo, historial_estados, created_at
) VALUES (
  'c1000000-0000-0000-0000-000000000001',
  'CEISH-2026-0001',
  'tipo-investigacion',
  'Uso de pantallas y desarrollo lingüístico en infantes',
  'Análisis descriptivo del impacto del tiempo frente a pantallas en el vocabulario expresivo en niños de 2 a 4 años.',
  'c0000000-0000-0000-0000-000000000001',
  jsonb_build_array(
    jsonb_build_object('cedula', '2000000001', 'nombre', 'Juan Pérez'),
    jsonb_build_object('cedula', '9999999999', 'nombre', 'Dra. María Andrade')
  ),
  'sin-riesgo',
  '[]'::jsonb,
  'creada',
  jsonb_build_array(jsonb_build_object(
    'id', 'ver-seed-001',
    'documentName', 'Protocolo_Pantallas_V1.pdf',
    'documentPath', 'mock/seed-proyecto-final-juan.pdf',
    'comment', 'Documento inicial para revisión.',
    'uploadedAt', (NOW() - INTERVAL '4 days')
  )),
  jsonb_build_array(jsonb_build_object(
    'estado', 'creada',
    'changedAt', (NOW() - INTERVAL '4 days'),
    'changedBy', 'Juan Pérez',
    'comment', 'Proyecto registrado en la plataforma.'
  )),
  NOW() - INTERVAL '4 days'
);

INSERT INTO ceish_documentos (
  id, codigo, tipo_documento_id, tema, descripcion, investigador_id, autores,
  riesgo_declarado, miembros_ceish_declarados, estado, versiones_archivo, historial_estados, created_at
) VALUES (
  'c1000000-0000-0000-0000-000000000002',
  'CEISH-2026-0002',
  'tipo-investigacion',
  'Percepción docente sobre la educación inclusiva',
  'Estudio de encuesta para medir actitudes y barreras percibidas por docentes de secundaria ante la inclusión educativa.',
  'c0000000-0000-0000-0000-000000000002',
  jsonb_build_array(
    jsonb_build_object('cedula', '2000000002', 'nombre', 'María López')
  ),
  'sin-riesgo',
  '[]'::jsonb,
  'estratificacion',
  jsonb_build_array(jsonb_build_object(
    'id', 'ver-seed-002',
    'documentName', 'Protocolo_Inclusion_Final.pdf',
    'documentPath', 'mock/seed-proyecto-final-juan.pdf',
    'comment', 'Se solicita revisión de exención ética.',
    'uploadedAt', (NOW() - INTERVAL '2 days')
  )),
  jsonb_build_array(
    jsonb_build_object(
      'estado', 'creada',
      'changedAt', (NOW() - INTERVAL '2 days'),
      'changedBy', 'María López',
      'comment', 'Registro del proyecto.'
    ),
    jsonb_build_object(
      'estado', 'estratificacion',
      'changedAt', (NOW() - INTERVAL '2 days'),
      'changedBy', 'María López',
      'comment', 'Revisión solicitada formalmente.'
    )
  ),
  NOW() - INTERVAL '2 days'
);

INSERT INTO ceish_asignaciones (documento_id, seccion_id, evaluador_id, active, assigned_at) VALUES
  ('c1000000-0000-0000-0000-000000000002', 'sec-estratificacion', 'b0000000-0000-0000-0000-000000000001', TRUE, NOW() - INTERVAL '2 days');

-- Los 2 documentos de arriba usan códigos escritos a mano (CEISH-2026-0001/0002);
-- se adelanta la secuencia para que el próximo crearDocumento no colisione con ellos.
SELECT setval('ceish_documento_codigo_seq', 2);
