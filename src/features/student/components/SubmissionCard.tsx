// [DEPRECATED - sin uso desde Fase 2 CEISH] Se conserva como referencia de estilos, no se importa en ningún lado.
import type { StudentSubmission } from '../../../shared/types/platform.types';

interface Props {
  submission: StudentSubmission;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_CONFIG = {
  pending: { label: 'Pendiente de revisión', cls: 'badge--warning' },
  'under-review': { label: 'En revisión', cls: 'badge--info' },
  reviewed: { label: 'Revisado', cls: 'badge--success' },
} as const;

export function SubmissionCard({ submission, onView, onEdit, onDelete }: Props) {
  const status = STATUS_CONFIG[submission.status];
  const isReviewed = submission.status === 'reviewed';

  return (
    <div className="submission-card">
      <div className="submission-card__top">
        <div className="submission-card__doc-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#eff6ff" />
            <path d="M7 5h14a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2z" stroke="#2563eb" strokeWidth="1.3" fill="none" />
            <path d="M9 11h10M9 14.5h10M9 18h6" stroke="#2563eb" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </div>
        <div className="submission-card__info">
          <p className="submission-card__filename">{submission.documentName}</p>
          <p className="submission-card__date">Enviado el {formatDateTime(submission.submittedAt)}</p>
        </div>
        <span className={`badge ${status.cls}`}>{status.label}</span>
      </div>

      {submission.comment && (
        <div className="submission-card__comment">
          <span className="submission-card__comment-label">Tu comentario</span>
          <p className="submission-card__comment-text">{submission.comment}</p>
        </div>
      )}

      {isReviewed && (
        <div className="submission-card__result">
          <div className="submission-card__grade">
            <span className="submission-card__grade-label">Calificación</span>
            <span className="submission-card__grade-value">
              {submission.grade?.toFixed(1)} <span className="submission-card__grade-max">/ 10</span>
            </span>
          </div>
          {submission.reviewedAt && (
            <p className="submission-card__review-date">
              Revisado el {formatDateTime(submission.reviewedAt)}
            </p>
          )}
          {submission.finalComment && (
            <div className="submission-card__final-comment">
              <span className="submission-card__comment-label">Comentario del evaluador</span>
              <p className="submission-card__comment-text">{submission.finalComment}</p>
            </div>
          )}
        </div>
      )}

      <div className="submission-card__actions">
        <button className="eval-btn eval-btn--outline" onClick={onView}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <circle cx="7" cy="7" r="1.6" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          Ver documento
        </button>
        {!isReviewed && (
          <>
            <button className="eval-btn eval-btn--outline" onClick={onEdit}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Editar entrega
            </button>
            <button className="eval-btn eval-btn--danger-outline" onClick={onDelete}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 4h9M5.5 4V2.5h3V4M6 6.5v4M8 6.5v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <rect x="3" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              Borrar entrega
            </button>
          </>
        )}
      </div>
    </div>
  );
}
