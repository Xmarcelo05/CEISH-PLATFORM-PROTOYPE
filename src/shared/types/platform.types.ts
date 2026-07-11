import type { Criterion } from '../../features/evaluation/types/evaluation.types';

export type UserRole = 'student' | 'evaluator' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cedula?: string;
}

export type SubmissionStatus = 'pending' | 'under-review' | 'reviewed';

export interface StudentSubmission {
  id: string;
  studentId: string;
  documentName: string;
  comment: string;
  status: SubmissionStatus;
  submittedAt: string;
  reviewedAt?: string;
  grade?: number;
  finalComment?: string; // shown anonymously to student
}

export type StageStatus = 'pending' | 'in-progress' | 'completed';

export interface ReviewStage {
  id: string;
  name: string;
  order: number;
  criteria: Criterion[];
  status: StageStatus;
}

export interface Review {
  id: string;
  submissionId: string;
  evaluatorId: string;
  studentId: string;
  stages: ReviewStage[];
  currentStageIndex: number;
  finalComment?: string;
  completedAt?: string;
  grade?: number;
}

export interface Assignment {
  id: string;
  evaluatorId: string;
  studentId: string;
  createdAt: string;
}

// ============================================================================
// NUEVO DOMINIO CEISH v3 (Motor Configurable de Workflow)
// ============================================================================

export type RiesgoTipo = 'sin-riesgo' | 'riesgo-minimo' | 'riesgo-mayor';

export type DocumentoEstado = 
  | 'creada'             // Borrador inicial
  | 'estratificacion'    // En Etapa 1 / 2 de la configuración
  | 'revision-tecnica'   // En Etapa 2 / 3 de la configuración
  | 'aprobada'           // Finalizado aprobado (Anexo 13)
  | 'anulada';           // Finalizado rechazado/anulado (Anexo 26)

export interface VersionArchivo {
  id: string;
  documentName: string;
  documentPath: string; // ID en el cache en memoria o storage simulado
  comment?: string;
  uploadedAt: string;
}

export interface HistorialEstado {
  estado: DocumentoEstado;
  changedAt: string;
  changedBy: string; // Nombre del usuario que ejecutó el cambio
  comment?: string;
}

export interface Cronometro {
  fechaAprobacion?: string; // Inicia al emitir aprobación (Anexo 13)
  diasEjecucion?: number;    // Días transcurridos o planificados
}

export interface Autor {
  cedula: string;
  nombre: string; // Autocompletado si existe en el sistema
}

// ─── Motor Configurable: Preguntas y Plantillas de Anexos ───────────────────
export type CampoTipo = 'checklist' | 'texto-libre' | 'archivo' | 'si-no';

export interface Pregunta {
  id: string;
  texto: string;
  tipo: CampoTipo;
  descripcionContexto?: string; // Texto descriptivo opcional antes de la pregunta
  orden: number;
  key?: string; // Nombre del tag en el Word (ej. "nombre_evaluador")
}

export interface AnexoTemplate {
  id: string;
  numero: number;
  nombre: string;
  rol: 'investigador' | 'evaluador';
  preguntas: Pregunta[];
  wordTemplateName?: string;        // Nombre del archivo de plantilla subido
  wordTemplateObjectKey?: string;   // Clave del objeto en MinIO (bucket "documents")
}

export interface AnexoAsignado {
  anexoTemplateId: string;
  obligatorio: boolean;
}

export interface Seccion {
  id: string;
  nombre: string;
  orden: number;
  anexos: AnexoAsignado[];
}

export interface TipoDocumento {
  id: string;
  nombre: string;
  secciones: Seccion[];
}

// ─── Instancia de Trámite (Documento) ────────────────────────────────────────
export interface Documento {
  id: string;
  codigo: string; // Generado, ej: "CEISH-2026-0001"
  tipoDocumentoId: string; // Referencia a TipoDocumento
  tema: string;
  descripcion: string;
  investigadorId: string;
  autores: Autor[];
  riesgoDeclarado: RiesgoTipo;
  riesgoConfirmado?: RiesgoTipo;
  miembrosCeishDeclarados: string[]; // IDs de evaluadores excluidos (conflicto)
  estado: DocumentoEstado;
  versionesArchivo: VersionArchivo[];
  historialEstados: HistorialEstado[];
  cronometro?: Cronometro;
  createdAt: string;
}

// ─── Respuestas a Anexos (Emisiones Llenadas con Snapshot) ───────────────────
export interface ValorCampo {
  campoId: string;
  valor: any; // boolean para checklist, string para texto-libre, { documentName, documentPath } para archivo
  observacion?: string;
}

export interface ComentarioAnotacion {
  id: string;
  texto: string;
  paginaPdf?: number; // Ubicación en el PDF
  autorId: string;
  autorNombre: string;
  campoId?: string;
  createdAt: string;
}

export interface RespuestaAnexo {
  id: string;
  anexoTemplateId: string;
  documentoId: string;
  seccionId: string; // ID dinámico de la Seccion
  versionArchivoId: string; // Versión evaluada
  emitidoPorId: string;
  emitidoPorNombre: string;
  emitidoAt: string;
  resultado: 
    | 'coincide' 
    | 'discrepa' 
    | 'aprobado' 
    | 'con-observaciones' 
    | 'baja' 
    | 'conflicto-interes';
  valores: ValorCampo[];
  comentariosAnotados: ComentarioAnotacion[];
  snapshotPreguntas: Pregunta[]; // Snapshot congelado de las preguntas para auditoría
}

// ─── Asignación de Revisores por Sección ─────────────────────────────────────
export interface AsignacionCEISH {
  id: string;
  documentoId: string;
  evaluadorId: string;
  seccionId: string; // ID real y dinámico de la Seccion
  assignedAt: string;
  active: boolean; // false si se inhibe
  bajaMotivo?: string;
  bajaAnexoId?: string; // ID del RespuestaAnexo (Anexo 23)
}

// ─── Escalamientos ────────────────────────────────────────────────────────────
export interface Escalamiento {
  id: string;
  respuestaAnexoId: string; // Puede enviarse vacío si no se ha respondido aún
  documentoId: string;
  seccionId: string;
  anexoTemplateId: string;
  comentarioEvaluador: string;
  estado: 'pendiente' | 'resuelto';
  edicionAdmin?: string; // El registro oficial
  notificado: boolean;
  createdAt: string;
}

// ─── Notificaciones y Mensajería ──────────────────────────────────────────────
export interface Notificacion {
  id: string;
  tipo: 'automatica' | 'manual';
  destinatarioId: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
}

// Aliases de compatibilidad para evitar romper el compilador durante la migración
export type Investigacion = Documento;
export type EmisionAnexo = RespuestaAnexo;
export type InvestigacionEstado = DocumentoEstado;


