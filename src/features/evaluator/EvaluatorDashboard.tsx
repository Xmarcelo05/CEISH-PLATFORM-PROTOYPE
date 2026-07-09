import { useAuthStore } from '../../store/authStore';
import { useCeishStore } from '../../store/ceishStore';
import { useNavigate } from 'react-router-dom';
import './evaluator.css';

export function EvaluatorDashboard() {
  const currentUser = useAuthStore((s) => s.currentUser)!;
  const { asignaciones, documentos } = useCeishStore();
  const navigate = useNavigate();

  // Filtrar asignaciones activas para este evaluador
  const misAsignaciones = asignaciones.filter(
    (asig) => asig.evaluadorId === currentUser.id && asig.active
  );

  // Mapear cada asignación con los detalles de su respectivo documento
  const tareasDeRevision = misAsignaciones.map((asig) => {
    const doc = documentos.find((d) => d.id === asig.documentoId);
    return {
      asignacion: asig,
      documento: doc
    };
  }).filter((item) => item.documento !== undefined);

  const getRiesgoBadge = (riesgo: string) => {
    const badges: Record<string, string> = {
      'sin-riesgo': 'eval-badge eval-badge--success',
      'riesgo-minimo': 'eval-badge eval-badge--in-progress',
      'riesgo-mayor': 'eval-badge eval-badge--rejected',
    };
    return badges[riesgo] || 'eval-badge';
  };

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { text: string; className: string }> = {
      creada: { text: 'Borrador', className: 'eval-badge eval-badge--pending' },
      estratificacion: { text: 'Etapa 2: Estratificación', className: 'eval-badge eval-badge--in-progress' },
      'revision-tecnica': { text: 'Etapa 3: Revisión Técnica', className: 'eval-badge' },
      aprobada: { text: 'Aprobada (Exenta)', className: 'eval-badge eval-badge--success' },
      anulada: { text: 'Anulada / Suspendida', className: 'eval-badge eval-badge--rejected' },
    };
    const badge = badges[estado] || { text: estado, className: 'eval-badge' };
    return <span className={badge.className}>{badge.text}</span>;
  };

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Mis Revisiones</h1>
          <p className="page__subtitle">
            {tareasDeRevision.length} revisiones activas asignadas · Sistema de Revisión Ciega (Confidencial)
          </p>
        </div>
      </div>

      <div className="page__body">
        
        {/* Banner de Revisión Ciega */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#1e3a8a',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <div>
            <strong>Garantía de Imparcialidad CEISH:</strong> Las identidades de los investigadores principales, co-autores y filiaciones institucionales se encuentran estrictamente ocultas durante todo el proceso de estratificación y evaluación técnica.
          </div>
        </div>

        <div className="card" style={{ padding: '20px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          {tareasDeRevision.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-state__icon" style={{ margin: '0 auto 16px auto' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#94a3b8" strokeWidth="1.5" />
                  <path d="m9 12 2 2 4-4" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="empty-state__title">No tienes tareas de revisión asignadas</h2>
              <p className="empty-state__desc" style={{ maxWidth: '400px', margin: '8px auto 0 auto', color: '#64748b' }}>
                Cuando el comité administrativo o el sistema ciego te asigne un protocolo para estratificación o evaluación ética, aparecerá en esta sección.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '13px' }}>
                  <th style={{ padding: '12px 8px' }}>Código</th>
                  <th style={{ padding: '12px 8px' }}>Tema / Título de la Investigación</th>
                  <th style={{ padding: '12px 8px' }}>Riesgo Declarado</th>
                  <th style={{ padding: '12px 8px' }}>Estado Actual</th>
                  <th style={{ padding: '12px 8px' }}>Fecha Asignación</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {tareasDeRevision.map(({ asignacion, documento }) => {
                  if (!documento) return null;

                  const isRiesgoFueraDeAlcance = 
                    documento.riesgoConfirmado === 'riesgo-minimo' || 
                    documento.riesgoConfirmado === 'riesgo-mayor';

                  return (
                    <tr 
                      key={asignacion.id} 
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                      className="hover-row"
                    >
                      <td style={{ padding: '14px 8px', fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                        {documento.codigo}
                      </td>
                      <td style={{ padding: '14px 8px', maxWidth: '350px' }}>
                        <p style={{ fontWeight: 500, fontSize: '14px', margin: 0, color: '#0f172a' }}>{documento.tema}</p>
                      </td>
                      <td style={{ padding: '14px 8px' }}>
                        <span className={getRiesgoBadge(documento.riesgoDeclarado)}>
                          {documento.riesgoDeclarado.replace('-', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '14px 8px' }}>
                        {getEstadoBadge(documento.estado)}
                      </td>
                      <td style={{ padding: '14px 8px', fontSize: '12px', color: '#64748b' }}>
                        {new Date(asignacion.assignedAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                        {isRiesgoFueraDeAlcance ? (
                          <span style={{ 
                            fontSize: '11px', 
                            color: '#b91c1c', 
                            background: '#fef2f2', 
                            border: '1px solid #fca5a5', 
                            padding: '4px 8px', 
                            borderRadius: '4px',
                            fontWeight: 500,
                            display: 'inline-block'
                          }}>
                            Riesgo Mínimo/Mayor (Fuera de Alcance)
                          </span>
                        ) : (
                          <button
                            className="eval-btn eval-btn--primary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => navigate(`/evaluador/revision-ceish/${documento.id}`)}
                          >
                            {documento.estado === 'estratificacion' 
                              ? 'Estratificar (Anexo 27)' 
                              : 'Revisar (Anexo 12)'
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
