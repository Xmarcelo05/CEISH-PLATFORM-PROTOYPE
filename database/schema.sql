-- ============================================================================
-- CEISH Platform — Esquema de base de datos
-- PostgreSQL 16
-- Se ejecuta automáticamente al crear el contenedor (volumen vacío).
-- ============================================================================

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- roles
-- ----------------------------------------------------------------------------
CREATE TABLE roles (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(40) NOT NULL UNIQUE
);

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,           -- texto plano solo para el prototipo
  role_id    UUID NOT NULL REFERENCES roles(id),
  cedula     VARCHAR(20),                     -- usada por el motor CEISH para detectar conflicto de interés autor↔evaluador
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role_id);

-- ----------------------------------------------------------------------------
-- submissions  (entrega de documentos)
-- ----------------------------------------------------------------------------
CREATE TABLE submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_name VARCHAR(255) NOT NULL,           -- nombre original del archivo
  document_path TEXT,                            -- clave del objeto en MinIO (bucket "documents")
  comment       TEXT NOT NULL DEFAULT '',
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'submitted', 'reviewed')),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  grade         NUMERIC(4,2) CHECK (grade >= 0 AND grade <= 10),
  final_comment TEXT                                 -- retroalimentación anónima para el estudiante
);

CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_submissions_status  ON submissions(status);

-- ----------------------------------------------------------------------------
-- assignments  (relación profesor - estudiante)
-- ----------------------------------------------------------------------------
CREATE TABLE assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT assignments_unique UNIQUE (teacher_id, student_id),
  CONSTRAINT assignments_distinct CHECK (teacher_id <> student_id)
);

CREATE INDEX idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX idx_assignments_student ON assignments(student_id);

-- ----------------------------------------------------------------------------
-- reviews
-- ----------------------------------------------------------------------------
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reviewer_id   UUID NOT NULL REFERENCES users(id),
  comment       TEXT NOT NULL DEFAULT '',
  grade         NUMERIC(4,2) CHECK (grade >= 0 AND grade <= 10),
  status        VARCHAR(20) NOT NULL DEFAULT 'in-progress'
                  CHECK (status IN ('in-progress', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT reviews_submission_unique UNIQUE (submission_id)
);

CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);

-- ----------------------------------------------------------------------------
-- review_stages  (evaluación dividida en etapas)
-- ----------------------------------------------------------------------------
CREATE TABLE review_stages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  stage_number SMALLINT NOT NULL CHECK (stage_number BETWEEN 1 AND 4),
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'in-progress', 'completed')),
  completed_at TIMESTAMPTZ,

  CONSTRAINT review_stages_unique UNIQUE (review_id, stage_number)
);

CREATE INDEX idx_review_stages_review ON review_stages(review_id);

-- ----------------------------------------------------------------------------
-- criteria_evaluations
-- ----------------------------------------------------------------------------
CREATE TABLE criteria_evaluations (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id  UUID NOT NULL REFERENCES review_stages(id) ON DELETE CASCADE,
  criterion TEXT NOT NULL,
  status    VARCHAR(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected')),
  comment   TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_criteria_stage ON criteria_evaluations(stage_id);

-- ----------------------------------------------------------------------------
-- annotations  (observaciones ubicadas dentro del PDF)
-- ----------------------------------------------------------------------------
CREATE TABLE annotations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criteria_evaluation_id UUID NOT NULL REFERENCES criteria_evaluations(id) ON DELETE CASCADE,
  page_number            SMALLINT NOT NULL CHECK (page_number >= 1),
  x                      NUMERIC(8,4) NOT NULL,   -- % del ancho de página (0-100)
  y                      NUMERIC(8,4) NOT NULL,   -- % del alto de página (0-100)
  width                  NUMERIC(8,4) NOT NULL,
  height                 NUMERIC(8,4) NOT NULL,
  comment                TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_annotations_criteria ON annotations(criteria_evaluation_id);

-- ============================================================================
-- Motor CEISH v3 (workflow configurable) — Etapa 1: configuración
-- Los ids son TEXT (no UUID) porque el código de negocio referencia algunos
-- ids de anexo de forma literal (p. ej. 'anexo-27' al confirmar exención),
-- igual que hacía el prototipo en memoria (src/store/ceishStore.ts).
-- Los campos JSONB se leen/escriben siempre como unidad completa junto a su
-- fila padre (nunca se consultan de forma independiente entre filas), así que
-- no se normalizan en tablas propias — ver CEISH_AVANCE.md para el criterio.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ceish_anexo_templates  (plantillas de anexo configurables por el admin)
-- ----------------------------------------------------------------------------
CREATE TABLE ceish_anexo_templates (
  id                        TEXT PRIMARY KEY,
  numero                    SMALLINT NOT NULL,
  nombre                    VARCHAR(255) NOT NULL,
  rol                       VARCHAR(20) NOT NULL CHECK (rol IN ('investigador', 'evaluador')),
  preguntas                 JSONB NOT NULL DEFAULT '[]',   -- Pregunta[]
  word_template_name        TEXT,
  word_template_object_key  TEXT,                          -- clave del objeto en MinIO (bucket "documents")
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- ceish_tipos_documento  (flujos configurables: secciones/etapas y sus anexos)
-- ----------------------------------------------------------------------------
CREATE TABLE ceish_tipos_documento (
  id         TEXT PRIMARY KEY,
  nombre     VARCHAR(255) NOT NULL,
  secciones  JSONB NOT NULL DEFAULT '[]',   -- Seccion[] (incluye anexos: AnexoAsignado[])
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Motor CEISH v3 — Etapa 2: trámites (documentos) y asignaciones
-- ============================================================================

-- Secuencia para el código de trámite (CEISH-<año>-NNNN), reemplaza el
-- `documentos.length + 1` del prototipo en memoria — que no era seguro ante
-- escrituras concurrentes.
CREATE SEQUENCE ceish_documento_codigo_seq START 1;

-- ----------------------------------------------------------------------------
-- ceish_documentos  (instancia de trámite/investigación)
-- ----------------------------------------------------------------------------
CREATE TABLE ceish_documentos (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                    VARCHAR(30) NOT NULL UNIQUE,
  tipo_documento_id         TEXT NOT NULL REFERENCES ceish_tipos_documento(id),
  tema                      VARCHAR(500) NOT NULL,
  descripcion               TEXT NOT NULL,
  investigador_id           UUID NOT NULL REFERENCES users(id),
  autores                   JSONB NOT NULL DEFAULT '[]',   -- Autor[]
  riesgo_declarado          VARCHAR(20) NOT NULL,
  riesgo_confirmado         VARCHAR(20),
  miembros_ceish_declarados JSONB NOT NULL DEFAULT '[]',   -- string[] (ids de evaluadores excluidos)
  estado                    VARCHAR(20) NOT NULL DEFAULT 'creada'
                               CHECK (estado IN ('creada', 'estratificacion', 'revision-tecnica', 'aprobada', 'anulada')),
  versiones_archivo         JSONB NOT NULL DEFAULT '[]',   -- VersionArchivo[] (documentPath = clave MinIO)
  historial_estados         JSONB NOT NULL DEFAULT '[]',   -- HistorialEstado[]
  cronometro                JSONB,                          -- Cronometro
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ceish_documentos_investigador ON ceish_documentos(investigador_id);

-- ----------------------------------------------------------------------------
-- ceish_asignaciones  (asignación ciega de evaluador por sección)
-- ----------------------------------------------------------------------------
CREATE TABLE ceish_asignaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id  UUID NOT NULL REFERENCES ceish_documentos(id) ON DELETE CASCADE,
  seccion_id    TEXT NOT NULL,
  evaluador_id  UUID NOT NULL REFERENCES users(id),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  baja_motivo   TEXT,
  baja_anexo_id UUID,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ceish_asignaciones_evaluador ON ceish_asignaciones(evaluador_id, active);
CREATE INDEX idx_ceish_asignaciones_documento ON ceish_asignaciones(documento_id, active);

-- ============================================================================
-- Motor CEISH v3 — Etapa 3: respuestas de anexos (borradores + emisiones)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ceish_respuestas_anexo
-- Una fila por (documento, anexo, versión de archivo): mientras es borrador
-- guarda resultado='coincide' (misma convención que el prototipo en memoria);
-- al emitir, guardarRespuestaAnexo/emitirAnexo hacen UPSERT sobre la misma
-- clave, así que la fila "borrador" se convierte en la emisión oficial.
-- ----------------------------------------------------------------------------
CREATE TABLE ceish_respuestas_anexo (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id         UUID NOT NULL REFERENCES ceish_documentos(id) ON DELETE CASCADE,
  anexo_template_id    TEXT NOT NULL,   -- sin FK dura: una plantilla borrada no debe romper respuestas históricas
  seccion_id           TEXT NOT NULL,
  version_archivo_id   TEXT NOT NULL,
  emitido_por_id       UUID NOT NULL REFERENCES users(id),
  emitido_por_nombre   VARCHAR(255) NOT NULL,
  emitido_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resultado            VARCHAR(30) NOT NULL,
  valores              JSONB NOT NULL DEFAULT '[]',   -- ValorCampo[]
  comentarios_anotados JSONB NOT NULL DEFAULT '[]',   -- ComentarioAnotacion[]
  snapshot_preguntas   JSONB NOT NULL DEFAULT '[]',   -- Pregunta[] congelado para auditoría

  CONSTRAINT ceish_respuestas_anexo_unique UNIQUE (documento_id, anexo_template_id, version_archivo_id)
);

CREATE INDEX idx_ceish_respuestas_documento ON ceish_respuestas_anexo(documento_id);

-- ============================================================================
-- Motor CEISH v3 — Etapa 4: escalamientos y notificaciones
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ceish_escalamientos  (situación elevada por un evaluador al administrador)
-- ----------------------------------------------------------------------------
CREATE TABLE ceish_escalamientos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  respuesta_anexo_id   UUID REFERENCES ceish_respuestas_anexo(id) ON DELETE SET NULL,
  documento_id         UUID NOT NULL REFERENCES ceish_documentos(id) ON DELETE CASCADE,
  seccion_id           TEXT NOT NULL,
  anexo_template_id    TEXT NOT NULL,
  comentario_evaluador TEXT NOT NULL,
  estado               VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'resuelto')),
  edicion_admin        TEXT,
  notificado           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ceish_escalamientos_estado ON ceish_escalamientos(estado);

-- ----------------------------------------------------------------------------
-- ceish_notificaciones
-- ----------------------------------------------------------------------------
CREATE TABLE ceish_notificaciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('automatica', 'manual')),
  destinatario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mensaje         TEXT NOT NULL,
  leida           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ceish_notificaciones_destinatario ON ceish_notificaciones(destinatario_id, leida);
