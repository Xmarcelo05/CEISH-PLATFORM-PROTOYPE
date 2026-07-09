import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useCeishStore } from '../../store/ceishStore';
import { ceishFileCache } from '../../store/fileCache';
import { CrearInvestigacionModal } from './components/CrearInvestigacionModal';
import './student.css';

export function SubmissionPage() {
  const currentUser = useAuthStore((s) => s.currentUser)!;
  const { investigaciones, asignaciones, anexosEmitidos, solicitarRevision } = useCeishStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);

  // Filtrar investigaciones creadas por el usuario actual
  const misInvestigaciones = investigaciones.filter((i) => i.investigadorId === currentUser.id);

  const selectedInv = investigaciones.find((i) => i.id === selectedInvId);

  // Acción para solicitar revisión
  const handleSolicitarRevision = (id: string) => {
    try {
      solicitarRevision(id, currentUser.name);
      window.alert('Solicitud de revisión enviada con éxito. Se ha asignado un revisor aleatorio (ciego) de manera automática.');
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  // Acción para abrir/ver el archivo PDF
  const handleVerArchivo = (versionId: string, documentName: string) => {
    const file = ceishFileCache[versionId];
    if (file) {
      const url = URL.createObjectURL(file);
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.alert(
        `Documento "${documentName}" no disponible.\n\nEn este prototipo, el archivo binario del PDF se mantiene en memoria de la sesión activa. Debido a que la página fue recargada, el archivo se ha limpiado de memoria. Vuelva a subir el archivo si requiere visualizarlo.`
      );
    }
  };

  // Renderizar badge de estado
  const renderEstadoBadge = (estado: string) => {
    const badges: Record<string, { text: string; className: string }> = {
      creada: { text: 'Borrador', className: 'eval-badge eval-badge--pending' },
      estratificacion: { text: 'Etapa 1: Estratificación', className: 'eval-badge eval-badge--in-progress' },
      'revision-tecnica': { text: 'Etapa 2: Revisión Técnica', className: 'eval-badge' },
      aprobada: { text: 'Aprobado (Exento)', className: 'eval-badge eval-badge--success' },
      anulada: { text: 'Anulada / Suspendida', className: 'eval-badge eval-badge--rejected' },
    };

    const badge = badges[estado] || { text: estado, className: 'eval-badge' };
    return <span className={badge.className}>{badge.text}</span>;
  };

  // Obtener la asignación activa para la investigación seleccionada
  const getAsignacionActiva = (invId: string) => {
    return asignaciones.find((a) => a.investigacionId === invId && a.active);
  };

  // Obtener emisiones de anexos para la investigación seleccionada
  const getEmisionesInv = (invId: string) => {
    return anexosEmitidos.filter((ae) => ae.investigacionId === invId);
  };

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Mis Investigaciones</h1>
          <p className="page__subtitle">Cree y gestione sus trámites de evaluación ética y metodológica ante el CEISH</p>
        </div>
        <button className="eval-btn eval-btn--primary" onClick={() => setModalOpen(true)}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ marginRight: '6px' }}>
            <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Registrar Proyecto
        </button>
      </div>

      <div className="page__body" style={{ display: 'grid', gridTemplateColumns: selectedInv ? '1fr 380px' : '1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Tabla / Lista de Investigaciones */}
        <div className="card" style={{ padding: '20px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          {misInvestigaciones.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-state__icon" style={{ margin: '0 auto 16px auto' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v13a2 2 0 01-2 2z" stroke="#94a3b8" strokeWidth="1.5" />
                  <path d="M12 11v6M9 14h6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="empty-state__title">No tienes investigaciones registradas</h2>
              <p className="empty-state__desc" style={{ maxWidth: '400px', margin: '8px auto 16px auto', color: '#64748b' }}>
                Comience registrando su protocolo de investigación y adjuntando el documento PDF correspondiente para solicitar la revisión.
              </p>
              <button className="eval-btn eval-btn--primary" onClick={() => setModalOpen(true)}>
                Registrar Proyecto
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '13px' }}>
                  <th style={{ padding: '12px 8px' }}>Código</th>
                  <th style={{ padding: '12px 8px' }}>Tema / Proyecto</th>
                  <th style={{ padding: '12px 8px' }}>Riesgo</th>
                  <th style={{ padding: '12px 8px' }}>Estado</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {misInvestigaciones.map((inv) => (
                  <tr 
                    key={inv.id} 
                    onClick={() => setSelectedInvId(inv.id)}
                    style={{ 
                      borderBottom: '1px solid #f1f5f9', 
                      cursor: 'pointer', 
                      background: selectedInvId === inv.id ? '#f8fafc' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                    className="hover-row"
                  >
                    <td style={{ padding: '14px 8px', fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                      {inv.codigo}
                    </td>
                    <td style={{ padding: '14px 8px' }}>
                      <p style={{ fontWeight: 500, fontSize: '14px', margin: 0, color: '#0f172a' }}>{inv.tema}</p>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>
                        Creado: {new Date(inv.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td style={{ padding: '14px 8px', fontSize: '13px', textTransform: 'capitalize' }}>
                      {inv.riesgoDeclarado.replace('-', ' ')}
                    </td>
                    <td style={{ padding: '14px 8px' }}>
                      {renderEstadoBadge(inv.estado)}
                    </td>
                    <td style={{ padding: '14px 8px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {inv.estado === 'creada' && (
                          <button
                            className="eval-btn eval-btn--primary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => handleSolicitarRevision(inv.id)}
                          >
                            Solicitar Revisión
                          </button>
                        )}
                        <button
                          className="eval-btn eval-btn--outline"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setSelectedInvId(inv.id === selectedInvId ? null : inv.id)}
                        >
                          {selectedInvId === inv.id ? 'Cerrar Detalle' : 'Ver Detalle'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Panel lateral de Detalle de Investigación */}
        {selectedInv && (
          <div className="card" style={{ padding: '20px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Detalle de Proyecto</h3>
              <button 
                onClick={() => setSelectedInvId(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600 }}>Título / Tema</p>
              <h4 style={{ margin: 0, fontSize: '14px', color: '#192231', fontWeight: 600 }}>{selectedInv.tema}</h4>
            </div>

            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600 }}>Resumen</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>{selectedInv.descripcion}</p>
            </div>

            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600 }}>Autores</p>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#334155' }}>
                {selectedInv.autores.map((a, i) => (
                  <li key={i}>{a} {i === 0 && <strong style={{ color: '#2563eb', fontSize: '11px' }}>(Principal)</strong>}</li>
                ))}
              </ul>
            </div>

            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600 }}>Documentos Cargados</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {selectedInv.versionesArchivo.map((v) => (
                  <div 
                    key={v.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      background: '#f8fafc', 
                      padding: '8px 10px', 
                      borderRadius: '6px', 
                      border: '1px solid #e2e8f0' 
                    }}
                  >
                    <div style={{ overflow: 'hidden', marginRight: '8px' }}>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.documentName}>
                        {v.documentName}
                      </p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                        Subido: {new Date(v.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button 
                      className="eval-btn eval-btn--outline" 
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => handleVerArchivo(v.documentPath, v.documentName)}
                    >
                      Ver PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Estado de Asignación Ciega (Si aplica) */}
            {selectedInv.estado !== 'creada' && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '6px' }}>
                <p style={{ fontSize: '11px', color: '#166534', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600 }}>Revisión CEISH</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#14532d' }}>
                  {getAsignacionActiva(selectedInv.id) 
                    ? 'Evaluador asignado. Evaluación en curso de forma ciega y confidencial.' 
                    : selectedInv.estado === 'aprobada' 
                      ? 'Revisión finalizada: Aprobado.' 
                      : selectedInv.estado === 'anulada'
                        ? 'Revisión finalizada: Proyecto Anulado/Suspendido.'
                        : 'En espera de asignación.'
                  }
                </p>
              </div>
            )}

            {/* Historial de Estados */}
            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 6px 0', textTransform: 'uppercase', fontWeight: 600 }}>Línea de Tiempo del Trámite</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', paddingLeft: '14px', borderLeft: '2px solid #e2e8f0', marginLeft: '6px' }}>
                {selectedInv.historialEstados.map((h, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <div style={{ 
                      position: 'absolute', 
                      left: '-21px', 
                      top: '4px', 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      background: idx === selectedInv.historialEstados.length - 1 ? '#2563eb' : '#94a3b8',
                      border: '2px solid white'
                    }} />
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                      {renderEstadoBadge(h.estado).props.children}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#475569' }}>
                      {h.comment}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#94a3b8' }}>
                      Por: {h.changedBy} · {new Date(h.changedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Resoluciones Emitidas (Anexos Oficiales) */}
            {getEmisionesInv(selectedInv.id).length > 0 && (
              <div>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', fontWeight: 600 }}>Anexos Emitidos</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getEmisionesInv(selectedInv.id).map((em) => (
                    <div 
                      key={em.id} 
                      style={{ 
                        padding: '10px', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '6px', 
                        background: '#f8fafc' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                          Anexo {em.anexoId.replace('anexo-', '')}
                        </span>
                        <span className={`eval-badge ${em.resultado === 'aprobado' || em.resultado === 'coincide' ? 'eval-badge--success' : 'eval-badge--rejected'}`} style={{ fontSize: '10px' }}>
                          {em.resultado === 'coincide' ? 'Exento (Coincide)' : em.resultado}
                        </span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>
                        Emitido el: {new Date(em.emitidoAt).toLocaleDateString()}
                      </p>
                      
                      {/* Mostrar justificación o comentarios del anexo emitido */}
                      {em.valores.map((val) => {
                        const template = useCeishStore.getState().templates.find(t => t.id === em.anexoId);
                        const campo = template?.campos.find(c => c.id === val.campoId);
                        if (campo && campo.tipo === 'texto-libre' && val.valor) {
                          return (
                            <div key={val.campoId} style={{ marginTop: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
                              <p style={{ margin: 0, fontSize: '11px', fontWeight: 500, color: '#475569' }}>Observación/Justificación:</p>
                              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                                "{val.valor}"
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <CrearInvestigacionModal
          onCancel={() => setModalOpen(false)}
          investigadorId={currentUser.id}
          investigadorNombre={currentUser.name}
        />
      )}
    </div>
  );
}
