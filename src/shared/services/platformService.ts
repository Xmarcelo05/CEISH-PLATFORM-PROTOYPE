// ============================================================================
// platformService — punto único de intercambio mock → API real.
//
// Mantiene exactamente la misma interfaz que consumían los hooks y componentes,
// pero ahora cada método llama a las rutas /api/* (respaldadas por PostgreSQL)
// y mapea las filas de la BD a los tipos que la UI ya espera.
//
// Diferencias BD ↔ UI que se traducen aquí:
//   - rol  'teacher'   (BD) ↔ 'evaluator'    (UI)
//   - estado 'submitted' (BD) ↔ 'under-review' (UI)
// ============================================================================

import type {
  User, UserRole, StudentSubmission, SubmissionStatus,
  Review, ReviewStage, Assignment,
} from '../types/platform.types';
import type { Criterion, CriterionStatus } from '../../features/evaluation/types/evaluation.types';

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiSend<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── DTOs (forma cruda que devuelve la API) ──────────────────────────────────

interface UserDTO { id: string; name: string; email: string; role: string; cedula: string | null }
interface SubmissionDTO {
  id: string; student_id: string; document_name: string; document_path: string | null;
  comment: string; status: string; submitted_at: string;
  reviewed_at: string | null; grade: number | null; final_comment: string | null;
}
interface AssignmentDTO {
  id: string; teacher_id: string; student_id: string; created_at: string;
}
interface AnnotationDTO { page_number: number }
interface CriterionDTO { id: string; criterion: string; status: string; comment: string; annotations: AnnotationDTO[] }
interface StageDTO { id: string; stage_number: number; status: string; criteria: CriterionDTO[] }
interface ReviewDTO {
  id: string; submission_id: string; student_id: string; reviewer_id: string;
  comment: string; grade: number | null; status: string; created_at: string; stages: StageDTO[];
}

// ─── Mapeos BD → UI ──────────────────────────────────────────────────────────

const STAGE_NAMES = ['Estructura', 'Metodología', 'Resultados', 'Formato'];

const num = (v: number | string | null): number | undefined =>
  v == null ? undefined : Number(v);

function mapRole(dbRole: string): UserRole {
  return dbRole === 'teacher' ? 'evaluator' : (dbRole as UserRole);
}

function mapSubStatus(dbStatus: string): SubmissionStatus {
  return dbStatus === 'submitted' ? 'under-review' : (dbStatus as SubmissionStatus);
}

function mapUser(d: UserDTO): User {
  return { id: d.id, name: d.name, email: d.email, role: mapRole(d.role), cedula: d.cedula ?? undefined };
}

function mapSubmission(d: SubmissionDTO): StudentSubmission {
  return {
    id: d.id,
    studentId: d.student_id,
    documentName: d.document_name,
    comment: d.comment,
    status: mapSubStatus(d.status),
    submittedAt: d.submitted_at,
    reviewedAt: d.reviewed_at ?? undefined,
    grade: num(d.grade),
    finalComment: d.final_comment ?? undefined,
  };
}

function mapAssignment(d: AssignmentDTO): Assignment {
  return { id: d.id, evaluatorId: d.teacher_id, studentId: d.student_id, createdAt: d.created_at };
}

function mapReview(d: ReviewDTO): Review {
  const stages: ReviewStage[] = d.stages
    .slice()
    .sort((a, b) => a.stage_number - b.stage_number)
    .map((s) => {
      const name = STAGE_NAMES[s.stage_number - 1] ?? `Etapa ${s.stage_number}`;
      const criteria: Criterion[] = s.criteria.map((c) => ({
        id: c.id,
        label: c.criterion,
        category: name,
        status: c.status as CriterionStatus,
        observation: c.comment,
        pageReference: c.annotations[0] ? Number(c.annotations[0].page_number) : undefined,
      }));
      return { id: s.id, name, order: s.stage_number, status: s.status as ReviewStage['status'], criteria };
    });

  // currentStageIndex se deriva del estado de las etapas (la BD no lo almacena)
  let currentStageIndex = stages.findIndex((s) => s.status === 'in-progress');
  if (currentStageIndex === -1) {
    currentStageIndex = stages.every((s) => s.status === 'completed') ? stages.length - 1 : 0;
  }

  return {
    id: d.id,
    submissionId: d.submission_id,
    evaluatorId: d.reviewer_id,
    studentId: d.student_id,
    stages,
    currentStageIndex,
    finalComment: d.comment || undefined,
    completedAt: d.status === 'completed' ? d.created_at : undefined,
    grade: num(d.grade),
  };
}

// ─── Mapeo UI → BD (para guardar la revisión) ────────────────────────────────

function toSaveReviewPayload(review: Review) {
  return {
    reviewId: review.id,
    submissionId: review.submissionId,
    status: review.completedAt ? 'completed' : 'in-progress',
    comment: review.finalComment ?? '',
    grade: review.grade ?? null,
    stages: review.stages.map((s) => ({
      stageNumber: s.order,
      status: s.status,
      completedAt: s.status === 'completed' ? new Date().toISOString() : null,
      criteria: s.criteria.map((c) => ({
        id: c.id,
        status: c.status,
        comment: c.observation ?? '',
        pageReference: c.pageReference ?? null,
      })),
    })),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const platformService = {
  // Users
  async getUsers(): Promise<User[]> {
    const data = await apiGet<UserDTO[]>('/api/users');
    return data.map(mapUser);
  },

  // Submissions
  async getSubmissionForStudent(studentId: string): Promise<StudentSubmission | null> {
    const data = await apiGet<SubmissionDTO | null>(`/api/submissions?studentId=${studentId}`);
    return data ? mapSubmission(data) : null;
  },

  async getAllSubmissions(): Promise<StudentSubmission[]> {
    const data = await apiGet<SubmissionDTO[]>('/api/submissions');
    return data.map(mapSubmission);
  },

  async createSubmission(
    studentId: string,
    documentName: string,
    comment: string,
    documentPath: string | null = null,
  ): Promise<StudentSubmission> {
    const data = await apiSend<SubmissionDTO>('POST', '/api/submissions', {
      studentId, documentName, comment, documentPath,
    });
    return mapSubmission(data);
  },

  async updateSubmission(
    id: string,
    patch: { documentName?: string; comment?: string; documentPath?: string },
  ): Promise<StudentSubmission> {
    const data = await apiSend<SubmissionDTO>('PATCH', `/api/submissions/${id}`, {
      documentName: patch.documentName,
      comment: patch.comment,
      documentPath: patch.documentPath,
    });
    return mapSubmission(data);
  },

  async deleteSubmission(id: string): Promise<void> {
    await apiSend('DELETE', `/api/submissions/${id}`);
  },

  // Assignments
  async getAssignments(): Promise<Assignment[]> {
    const data = await apiGet<AssignmentDTO[]>('/api/assignments');
    return data.map(mapAssignment);
  },

  async getAssignmentsForEvaluator(evaluatorId: string): Promise<Assignment[]> {
    const data = await apiGet<AssignmentDTO[]>(`/api/assignments?teacherId=${evaluatorId}`);
    return data.map(mapAssignment);
  },

  async createAssignment(evaluatorId: string, studentId: string): Promise<Assignment> {
    const data = await apiSend<AssignmentDTO>('POST', '/api/assignments', {
      teacherId: evaluatorId, studentId,
    });
    return mapAssignment(data);
  },

  async deleteAssignment(id: string): Promise<void> {
    await apiSend('DELETE', `/api/assignments/${id}`);
  },

  // Reviews
  async getOrCreateReview(submissionId: string, evaluatorId: string): Promise<Review> {
    const data = await apiSend<ReviewDTO>('POST', '/api/reviews', { submissionId, evaluatorId });
    return mapReview(data);
  },

  async saveReview(review: Review): Promise<void> {
    await apiSend('PUT', `/api/reviews/${review.id}`, toSaveReviewPayload(review));
  },
};
