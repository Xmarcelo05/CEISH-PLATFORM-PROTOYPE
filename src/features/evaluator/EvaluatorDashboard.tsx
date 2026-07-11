import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useCeishStore } from '../../store/ceishStore';
import { useNavigate } from 'react-router-dom';
import { ceishService } from '../../services/ceishService';
import './evaluator.css';

export function EvaluatorDashboard() {
  const currentUser = useAuthStore((s) => s.currentUser)!;
  const { asignaciones, documentos } = useCeishStore();
  const navigate = useNavigate();

  // Estado local para filtrar las revisiones por pestaña
  const [filtroTab, setFiltroTab] = useState<'pendientes' | 'suspendidas' | 'completadas'>('pendientes');
  
  // Estado local para el documento seleccionado para vista dividida (split-screen)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Reiniciar el documento seleccionado al cambiar de pestaña
  useEffect(() => {
    setSelectedDocId(null);
  }, [filtroTab]);

  // Filtrar todas las asignaciones asociadas a este evaluador
  const misAsignaciones = asignaciones.filter(
    (asig) => asig.evaluadorId === currentUser.id
  );

  // Mapear cada asignación con su correspondiente documento
  const todasTareas = misAsignaciones.map((asig) => {
    const doc = documentos.find((d) => d.id === asig.documentoId);
    return {
      asignacion: asig,
      documento: doc
    };
  }).filter((item) => item.documento !== undefined);

  // Clasificar tareas para los contadores y filtros
  const tareasPendientes = todasTareas.filter(t => 
    t.asignacion.active && (t.documento!.estado === 'estratificacion' || t.documento!.estado === 'revision-tecnica')
  );

  const tareasSuspendidas = todasTareas.filter(t => 
    t.documento!.estado === 'anulada'
  );

  const tareasCompletadas = todasTareas.filter(t => 
    t.documento!.estado === 'aprobada'
  );

  const tareasFiltradas = 
    filtroTab === 'pendientes' ? tareasPendientes :
    filtroTab === 'suspendidas' ? tareasSuspendidas :
    tareasCompletadas;

  // Documento seleccionado actualmente
  const selectedTask = tareasFiltradas.find(t => t.documento!.id === selectedDocId);
  const selectedDoc = selectedTask?.documento;

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

  const handleVerArchivo = (versionPath: string) => {
    window.open(ceishService.getFileRawUrl(versionPath), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Panel de Revisiones</h1>
          <p className="page__subtitle">
            {tareasPendientes.length} tareas de evaluación activas asignadas bajo sistema de revisión ciega
          </p>
        </div>
      </div>

      <div className="page__body" style={{ display: 'grid', gridTemplateColumns: selectedDoc ? '1fr 400px' : '1fr', gap: '20px', alignItems: 'start', transition: 'grid-template-columns 0.3s ease' }}>
        
        {/* LADO IZQUIERDO: Listado de Revisiones */}
        <div className="card" style={{ padding: '20px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
          
          {/* Banner de Revisión Ciega */}
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            padding: '12px 14px',
            color: '#1e3a8a',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
            <div>
              <strong>Revisión Ciega Garantizada:</strong> Las identidades de los autores y co-autores se encuentran estrictamente anonimizadas para los evaluadores asignados.
            </div>
          </div>

          {/* Selector de Pestañas de Revisión */}
          <div className="eval-tabs" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '16px', display: 'flex', gap: '6px' }}>
            <button
              className={`eval-tabs__btn ${filtroTab === 'pendientes' ? 'active' : ''}`}
              onClick={() => setFiltroTab('pendientes')}
              style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Pendientes ({tareasPendientes.length})
            </button>
            <button
              className={`eval-tabs__btn ${filtroTab === 'suspendidas' ? 'active' : ''}`}
              onClick={() => setFiltroTab('suspendidas')}
              style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Suspendidas ({tareasSuspendidas.length})
            </button>
            <button
              className={`eval-tabs__btn ${filtroTab === 'completadas' ? 'active' : ''}`}
              onClick={() => setFiltroTab('completadas')}
              style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Completadas ({tareasCompletadas.length})
            </button>
          </div>

          {/* Tabla Responsive con Scrollbar */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #f1f5f9', borderRadius: '6px' }}>
            {tareasFiltradas.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 10px' }}>
                <div className="empty-state__icon" style={{ margin: '0 auto 12px auto' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="1.5" />
                    <path d="m9 12 2 2 4-4" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="empty-state__title" style={{ fontSize: '14px', color: '#475569' }}>No hay revisiones en esta sección</h3>
                <p className="empty-state__desc" style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                  {filtroTab === 'pendientes' && 'Los protocolos que te sean asignados de forma ciega aparecerán aquí.'}
                  {filtroTab === 'suspendidas' && 'Aquí se registran los proyectos que hayan sido anulados o archivados definitivamente.'}
                  {filtroTab === 'completadas' && 'Aquí se listan los proyectos que ya aprobaste formalmente.'}
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12.5px', background: '#f8fafc' }}>
                    <th style={{ padding: '10px 12px' }}>Código</th>
                    <th style={{ padding: '10px 12px' }}>Título / Tema</th>
                    <th style={{ padding: '10px 12px' }}>Riesgo</th>
                    <th style={{ padding: '10px 12px' }}>Estado</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {tareasFiltradas.map(({ asignacion, documento }) => {
                    if (!documento) return null;

                    return (
                      <tr 
                        key={asignacion.id} 
                        onClick={() => setSelectedDocId(documento.id === selectedDocId ? null : documento.id)}
                        style={{ 
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          background: selectedDocId === documento.id ? '#f8fafc' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                        className="hover-row"
                      >
                        <td style={{ padding: '12px', fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                          {documento.codigo}
                        </td>
                        <td style={{ padding: '12px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 500, fontSize: '13.5px', color: '#0f172a' }} title={documento.tema}>
                            {documento.tema}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span className={getRiesgoBadge(documento.riesgoDeclarado)}>
                            {documento.riesgoDeclarado.replace('-', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {getEstadoBadge(documento.estado)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="eval-btn eval-btn--outline"
                            style={{ padding: '4px 10px', fontSize: '11.5px' }}
                            onClick={() => setSelectedDocId(documento.id === selectedDocId ? null : documento.id)}
                          >
                            {selectedDocId === documento.id ? 'Ocultar' : 'Ver Detalle'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* LADO DERECHO: Panel de Detalle de Evaluación (Split-Screen Interactivo) */}
        {selectedDoc && (
          <div className="card" style={{ padding: '20px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', animation: 'slideIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>Detalle de Revisión</h3>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{selectedDoc.codigo}</span>
              </div>
              <button 
                onClick={() => setSelectedDocId(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div>
              <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 2px 0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Título del Proyecto</p>
              <h4 style={{ margin: 0, fontSize: '13.5px', color: '#1e293b', fontWeight: 600, lineHeight: '1.4' }}>{selectedDoc.tema}</h4>
            </div>

            <div>
              <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 2px 0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Resumen Ejecutivo</p>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: '1.5' }}>{selectedDoc.descripcion}</p>
            </div>

            {/* Documentos subidos */}
            <div>
              <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Documentos Cargados</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedDoc.versionesArchivo.map((v, idx) => (
                  <div 
                    key={v.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      background: '#f8fafc', 
                      padding: '6px 10px', 
                      borderRadius: '6px', 
                      border: '1px solid #e2e8f0' 
                    }}
                  >
                    <div style={{ overflow: 'hidden', marginRight: '6px' }}>
                      <p style={{ margin: 0, fontSize: '11.5px', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        v{idx + 1}: {v.documentName}
                      </p>
                      <p style={{ margin: '1px 0 0 0', fontSize: '9.5px', color: '#64748b' }}>
                        {new Date(v.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button 
                      className="eval-btn eval-btn--outline" 
                      style={{ padding: '2px 6px', fontSize: '10.5px', flexShrink: 0 }}
                      onClick={() => handleVerArchivo(v.documentPath)}
                    >
                      Ver PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Línea de Tiempo del Trámite */}
            <div>
              <p style={{ fontSize: '10px', color: '#64748b', margin: '0 0 6px 0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Bitácora del Trámite</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', paddingLeft: '12px', borderLeft: '2px solid #e2e8f0', marginLeft: '4px' }}>
                {selectedDoc.historialEstados.map((h, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <div style={{ 
                      position: 'absolute', 
                      left: '-18px', 
                      top: '3px', 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: idx === selectedDoc.historialEstados.length - 1 ? '#2563eb' : '#cbd5e1',
                      border: '2px solid white'
                    }} />
                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#1e293b' }}>
                      {getEstadoBadge(h.estado).props.children}
                    </p>
                    <p style={{ margin: '1px 0 0 0', fontSize: '10.5px', color: '#475569', lineHeight: '1.3' }}>
                      {h.comment}
                    </p>
                    <p style={{ margin: '1px 0 0 0', fontSize: '9px', color: '#94a3b8' }}>
                      Por: {h.changedBy} · {new Date(h.changedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Botón de Acción Principal destacado */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '6px' }}>
              {selectedDoc.riesgoConfirmado === 'riesgo-minimo' || selectedDoc.riesgoConfirmado === 'riesgo-mayor' ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
                    ⚠️ Riesgo confirmado fuera de alcance del CEISH
                  </p>
                </div>
              ) : (
                <button
                  className="eval-btn eval-btn--primary"
                  style={{ width: '100%', padding: '8px', fontSize: '13px', fontWeight: 600 }}
                  onClick={() => navigate(`/evaluador/revision-ceish/${selectedDoc.id}`)}
                >
                  {filtroTab === 'pendientes' ? (
                    selectedDoc.estado === 'estratificacion' 
                      ? 'Comenzar Estratificación (Anexo 27)' 
                      : 'Continuar Evaluación Técnica (Anexo 12)'
                  ) : (
                    'Consultar Formulario y Dictamen'
                  )}
                </button>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
