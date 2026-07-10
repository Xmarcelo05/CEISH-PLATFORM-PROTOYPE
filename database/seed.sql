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
INSERT INTO users (id, name, email, password, role_id) VALUES
  -- admin demo
  ('a0000000-0000-0000-0000-000000000001', 'Admin Demo',   'admin@ceish.edu',   'demo123', '33333333-3333-3333-3333-333333333333'),
  -- profesor demo
  ('b0000000-0000-0000-0000-000000000001', 'Profesor Demo','profesor@ceish.edu','demo123', '22222222-2222-2222-2222-222222222222'),
  -- evaluadores adicionales
  ('b0000000-0000-0000-0000-000000000002', 'Evaluador Alterno CEISH', 'alterno@ceish.edu', 'demo123', '22222222-2222-2222-2222-222222222222'),
  ('b0000000-0000-0000-0000-000000000003', 'Dr. Roberto Anchundia', 'roberto@ceish.edu', 'demo123', '22222222-2222-2222-2222-222222222222'),
  -- estudiantes demo
  ('c0000000-0000-0000-0000-000000000001', 'Juan Pérez',   'juan@ceish.edu',    'demo123', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000002', 'María López',  'maria@ceish.edu',   'demo123', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000003', 'Carlos Ruiz',  'carlos@ceish.edu',  'demo123', '11111111-1111-1111-1111-111111111111');

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
