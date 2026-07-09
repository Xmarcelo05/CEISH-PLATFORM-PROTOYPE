import type { Criterion } from '../../features/evaluation/types/evaluation.types';

export type UserRole = 'student' | 'evaluator' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
// NUEVO DOMINIO CEISH (Fase: Prototipo Funcional - Flujo "Sin Riesgo")
// ============================================================================

export type RiesgoTipo = 'sin-riesgo' | 'riesgo-minimo' | 'riesgo-mayor';

export type InvestigacionEstado = 
  | 'creada' 
  | 'estratificacion' 
  | 'revision-tecnica' 
  | 'aprobada' 
  | 'anulada';

export interface VersionArchivo {
  id: string;
  documentName: string;
  documentPath: string; // Identificador o ruta del archivo en el Storage (MinIO)
  comment?: string;
  uploadedAt: string;
}

export interface HistorialEstado {
  estado: InvestigacionEstado;
  changedAt: string;
  changedBy: string; // Nombre o ID del usuario que realizó el cambio
  comment?: string;
}

export interface Cronometro {
  fechaAprobacion?: string; // Inicia al aprobarse la investigación (Anexo 13)
  diasEjecucion?: number;    // Días transcurridos o planificados
}

export interface Investigacion {
  id: string;
  codigo: string; // Identificador único generado por el sistema, ej: "CEISH-2026-0001"
  tema: string;
  descripcion: string;
  investigadorId: string;
  autores: string[]; // Lista de nombres de co-autores
  riesgoDeclarado: RiesgoTipo;
  riesgoConfirmado?: RiesgoTipo;
  miembrosCeishDeclarados: string[]; // IDs de evaluadores declarados con conflicto de interés
  estado: InvestigacionEstado;
  versionesArchivo: VersionArchivo[];
  historialEstados: HistorialEstado[];
  cronometro?: Cronometro;
  createdAt: string;
}

// ─── Plantillas de Anexos (Configurables) ────────────────────────────────────
export type CampoTipo = 'checklist' | 'cumple-nocumple' | 'comentarios-solo' | 'texto-libre';

export interface AnexoCampo {
  id: string;
  label: string;
  tipo: CampoTipo;
  opciones?: string[]; // Para opciones de tipo checklist si fuera necesario
}

export interface AnexoTemplate {
  id: string;      // Identificador de plantilla, ej: "anexo-27"
  numero: number;  // Número de anexo, ej: 27
  nombre: string;  // Nombre descriptivo del anexo
  campos: AnexoCampo[];
}

// ─── Instancias de Emisión de Anexos (Formularios Llenados) ───────────────────
export interface ComentarioAnotacion {
  id: string;
  texto: string;
  paginaPdf?: number; // Ubicación en el PDF
  autorId: string;
  autorNombre: string;
  campoId?: string; // Campo al que está ligado
  createdAt: string;
}

export interface ValorCampo {
  campoId: string;
  valor: any; // boolean para checklist/cumple, string para comentarios/texto
  observacion?: string; // Observación específica para este campo
}

export interface EmisionAnexo {
  id: string;
  anexoId: string; // Referencia a AnexoTemplate
  investigacionId: string;
  etapa: 'estratificacion' | 'revision-tecnica';
  versionArchivoId: string; // ID de la versión evaluada
  emitidoPorId: string;     // ID del Revisor/Evaluador
  emitidoPorNombre: string;
  emitidoAt: string;
  resultado: 
    | 'coincide'            // Confirmación de exención de riesgo (Etapa 1)
    | 'discrepa'            // Se corrige la estratificación
    | 'aprobado'            // Aprobación final sin observaciones (Anexo 13)
    | 'con-observaciones'   // Devuelto con observaciones (Anexo 12)
    | 'baja'                // Suspensión/Revocatoria (Anexo 26)
    | 'conflicto-interes';   // Revisor se da de baja (Anexo 23)
  valores: ValorCampo[];
  comentariosAnotados: ComentarioAnotacion[];
}

// ─── Asignación de Revisores ──────────────────────────────────────────────────
export interface AsignacionCEISH {
  id: string;
  investigacionId: string;
  evaluadorId: string;
  tipoRevision: 'estratificacion' | 'revision-tecnica';
  assignedAt: string;
  active: boolean; // false si se da de baja (Anexo 23)
  bajaMotivo?: string;
  bajaAnexoId?: string; // ID del Anexo 23 que justifica la baja
}

