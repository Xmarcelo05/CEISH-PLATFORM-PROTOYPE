import { useEffect, useState } from 'react';
import { platformService } from '../../shared/services/platformService';
import { useCeishStore } from '../../store/ceishStore';
import type { User, StudentSubmission, Assignment, Documento, RiesgoTipo, DocumentoEstado } from '../../shared/types/platform.types';
import './admin.css';
import '../evaluation/evaluation.css';

interface EvaluatorRow {
  evaluator: User;
  students: { student: User; submission: StudentSubmission | null }[];
}

const STATUS_CONFIG = {
  none: { label: 'Sin entrega', cls: 'badge--neutral' },
  pending: { label: 'Pendiente', cls: 'badge--warning' },
  'under-review': { label: 'En revisión', cls: 'badge--info' },
  reviewed: { label: 'Revisado', cls: 'badge--success' },
} as const;

export function AdminDashboard() {
  const [rows, setRows] = useState<EvaluatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  // Tabs: 'proyectos', 'evaluadores' o 'investigadores'
  const [activeTab, setActiveTab] = useState<'proyectos' | 'evaluadores' | 'investigadores'>('proyectos');

  // CEISH documents search & filters
  const { documentos, asignaciones, editarDocumento } = useCeishStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DocumentoEstado>('all');

  // CEISH editing modal state
  const [editingDoc, setEditingDoc] = useState<Documento | null>(null);
  const [editTema, setEditTema] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editRiesgoDeclarado, setEditRiesgoDeclarado] = useState<RiesgoTipo>('sin-riesgo');
  const [editRiesgoConfirmado, setEditRiesgoConfirmado] = useState<RiesgoTipo | 'none'>('none');
  const [editEstado, setEditEstado] = useState<DocumentoEstado>('creada');
  const [editEvaluadorId, setEditEvaluadorId] = useState<string>('');

  // Modal de proyectos por investigador
  const [selectedResearcherForProjects, setSelectedResearcherForProjects] = useState<User | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [allUsers, allAssignments, allSubs]: [User[], Assignment[], StudentSubmission[]] = await Promise.all([
        platformService.getUsers(),
        platformService.getAssignments(),
        platformService.getAllSubmissions(),
      ]);
      setUsers(allUsers);
      const evaluators = allUsers.filter((u) => u.role === 'evaluator');
      const result: EvaluatorRow[] = evaluators.map((ev) => {
        const studentIds = allAssignments.filter((a) => a.evaluatorId === ev.id).map((a) => a.studentId);
        const students = allUsers.filter((u) => studentIds.includes(u.id)).map((s) => ({
          student: s,
          submission: allSubs.find((sub) => sub.studentId === s.id) ?? null,
        }));
        return { evaluator: ev, students };
      });
      setRows(result);
    } catch (e) {
      console.error('Error al cargar datos en el panel de administración:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenEdit = (doc: Documento) => {
    setEditingDoc(doc);
    setEditTema(doc.tema);
    setEditDescripcion(doc.descripcion);
    setEditRiesgoDeclarado(doc.riesgoDeclarado);
    setEditRiesgoConfirmado(doc.riesgoConfirmado || 'none');
    setEditEstado(doc.estado);
    const activeAsig = asignaciones.find(a => a.documentoId === doc.id && a.active);
    setEditEvaluadorId(activeAsig ? activeAsig.evaluadorId : '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;

    const campos = {
      tema: editTema,
      descripcion: editDescripcion,
      riesgoDeclarado: editRiesgoDeclarado,
      riesgoConfirmado: editRiesgoConfirmado === 'none' ? null : editRiesgoConfirmado,
      estado: editEstado,
    };

    try {
      // editEvaluadorId siempre se envía (aunque sea '') — el servidor interpreta
      // '' como "desasignar" y cualquier id como "reasignar", en una sola transacción.
      await editarDocumento(editingDoc.id, campos, editEvaluadorId);
      setEditingDoc(null);
      window.alert('Proyecto modificado con éxito.');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al modificar el proyecto.');
    }
  };

  const getEstadoBadge = (estado: DocumentoEstado) => {
    const configs: Record<DocumentoEstado, { label: string; cls: string }> = {
      creada: { label: 'Borrador', cls: 'badge--neutral' },
      estratificacion: { label: 'Estratificación', cls: 'badge--info' },
      'revision-tecnica': { label: 'Rev. Técnica', cls: 'badge--warning' },
      aprobada: { label: 'Aprobada', cls: 'badge--success' },
      anulada: { label: 'Anulada', cls: 'badge--danger' }
    };
    const config = configs[estado] || { label: estado, cls: 'badge--neutral' };
    return <span className={`badge ${config.cls}`}>{config.label}</span>;
  };

  const getRiesgoBadge = (riesgo: RiesgoTipo) => {
    const configs: Record<RiesgoTipo, { label: string; cls: string }> = {
      'sin-riesgo': { label: 'Sin Riesgo', cls: 'badge--success' },
      'riesgo-minimo': { label: 'Riesgo Mínimo', cls: 'badge--warning' },
      'riesgo-mayor': { label: 'Riesgo Mayor', cls: 'badge--danger' }
    };
    const config = configs[riesgo] || { label: riesgo, cls: 'badge--neutral' };
    return <span className={`badge ${config.cls}`}>{config.label}</span>;
  };

  // Filtrar documentos CEISH
  const filteredDocumentos = documentos.filter(doc => {
    const researcher = users.find(u => u.id === doc.investigadorId);
    const researcherName = researcher ? researcher.name : '';
    const evaluatorActive = asignaciones.find(a => a.documentoId === doc.id && a.active);
    const evaluatorName = evaluatorActive ? (users.find(u => u.id === evaluatorActive.evaluadorId)?.name || '') : '';

    const matchesSearch = 
      doc.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.tema.toLowerCase().includes(searchTerm.toLowerCase()) ||
      researcherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evaluatorName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || doc.estado === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page">
      <div className="page__header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page__title">Panel de Control del Administrador</h1>
            <p className="page__subtitle">Gestión global de investigaciones, asignaciones ciegas y estados de evaluación</p>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="eval-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--c-border)', paddingBottom: '8px' }}>
          <button 
            className={`eval-tabs__btn ${activeTab === 'proyectos' ? 'active' : ''}`}
            onClick={() => setActiveTab('proyectos')}
            style={{
              padding: '8px 16px',
              fontWeight: 600,
              fontSize: '13.5px',
              borderRadius: '6px',
              cursor: 'pointer',
              background: activeTab === 'proyectos' ? 'var(--c-primary-light)' : 'transparent',
              color: activeTab === 'proyectos' ? 'var(--c-primary)' : 'var(--c-text-muted)',
              border: activeTab === 'proyectos' ? '1px solid var(--c-primary-border)' : '1px solid transparent',
            }}
          >
            📋 Proyectos Registrados ({documentos.length})
          </button>
          <button 
            className={`eval-tabs__btn ${activeTab === 'evaluadores' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluadores')}
            style={{
              padding: '8px 16px',
              fontWeight: 600,
              fontSize: '13.5px',
              borderRadius: '6px',
              cursor: 'pointer',
              background: activeTab === 'evaluadores' ? 'var(--c-primary-light)' : 'transparent',
              color: activeTab === 'evaluadores' ? 'var(--c-primary)' : 'var(--c-text-muted)',
              border: activeTab === 'evaluadores' ? '1px solid var(--c-primary-border)' : '1px solid transparent',
            }}
          >
            👥 Carga de Evaluadores ({rows.length})
          </button>
          <button 
            className={`eval-tabs__btn ${activeTab === 'investigadores' ? 'active' : ''}`}
            onClick={() => setActiveTab('investigadores')}
            style={{
              padding: '8px 16px',
              fontWeight: 600,
              fontSize: '13.5px',
              borderRadius: '6px',
              cursor: 'pointer',
              background: activeTab === 'investigadores' ? 'var(--c-primary-light)' : 'transparent',
              color: activeTab === 'investigadores' ? 'var(--c-primary)' : 'var(--c-text-muted)',
              border: activeTab === 'investigadores' ? '1px solid var(--c-primary-border)' : '1px solid transparent',
            }}
          >
            🎓 Investigadores Registrados ({users.filter(u => u.role === 'student').length})
          </button>
        </div>
      </div>

      <div className="page__body">
        {loading ? (
          <div className="page__loading"><div className="pdf-spinner" /><span>Cargando datos del sistema...</span></div>
        ) : activeTab === 'proyectos' ? (
          /* PESTAÑA PROYECTOS */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Barra de Búsqueda y Filtros */}
            <div style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              background: 'white',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid var(--c-border)',
              boxShadow: 'var(--shadow-sm)',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-subtle)' }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar por código, tema, investigador o revisor..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      border: '1px solid var(--c-border)',
                      outline: 'none',
                      background: 'var(--c-surface-2)',
                      color: 'var(--c-text)'
                    }}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as DocumentoEstado | 'all')}
                  style={{
                    padding: '10px 16px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid var(--c-border)',
                    outline: 'none',
                    background: 'var(--c-surface-2)',
                    color: 'var(--c-text)',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">Todos los estados</option>
                  <option value="creada">Borrador</option>
                  <option value="estratificacion">Estratificación (Etapa 2)</option>
                  <option value="revision-tecnica">Evaluación Técnica (Etapa 3)</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="anulada">Anulada / Suspendida</option>
                </select>
              </div>
            </div>

            {/* Tabla de Proyectos */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid var(--c-border)',
              boxShadow: 'var(--shadow-sm)',
              overflow: 'hidden'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-surface-2)', borderBottom: '2px solid var(--c-border)', color: 'var(--c-text-2)', fontWeight: 600 }}>
                      <th style={{ padding: '14px 16px', width: '120px' }}>Código</th>
                      <th style={{ padding: '14px 16px', minWidth: '220px' }}>Tema / Título</th>
                      <th style={{ padding: '14px 16px', width: '150px' }}>Investigador</th>
                      <th style={{ padding: '14px 16px', width: '180px' }}>Co-autores</th>
                      <th style={{ padding: '14px 16px', width: '140px' }}>Estado</th>
                      <th style={{ padding: '14px 16px', width: '120px' }}>Riesgo Dec.</th>
                      <th style={{ padding: '14px 16px', width: '150px' }}>Revisor Asignado</th>
                      <th style={{ padding: '14px 16px', width: '100px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocumentos.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--c-text-muted)' }}>
                          No se encontraron proyectos registrados con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredDocumentos.map(doc => {
                        const researcher = users.find(u => u.id === doc.investigadorId);
                        const researcherName = researcher ? researcher.name : 'Desconocido';
                        const activeAsig = asignaciones.find(a => a.documentoId === doc.id && a.active);
                        const evaluator = activeAsig ? users.find(u => u.id === activeAsig.evaluadorId) : null;
                        const evaluatorName = evaluator ? evaluator.name : 'Sin asignar';
                        
                        return (
                          <tr key={doc.id} style={{ borderBottom: '1px solid var(--c-border)' }} className="hover-row">
                            <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--c-text)' }}>
                              {doc.codigo}
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                              <div style={{ maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.tema}>
                                {doc.tema}
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px' }}>{researcherName}</td>
                            <td style={{ padding: '14px 16px', color: 'var(--c-text-muted)', fontSize: '12.5px' }}>
                              {doc.autores.length > 0 ? doc.autores.map(a => a.nombre).join(', ') : 'Ninguno'}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              {getEstadoBadge(doc.estado)}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              {getRiesgoBadge(doc.riesgoDeclarado)}
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 500, color: evaluator ? 'var(--c-text)' : 'var(--c-text-subtle)' }}>
                              {evaluatorName}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                              <button 
                                className="eval-btn eval-btn--sm eval-btn--outline"
                                onClick={() => handleOpenEdit(doc)}
                                style={{ fontWeight: 600 }}
                              >
                                Editar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : activeTab === 'evaluadores' ? (
          /* PESTAÑA EVALUADORES (CARGA DE TRABAJO) */
          <div className="admin-evaluators">
            {rows.map((row) => (
              <div key={row.evaluator.id} className="evaluator-block">
                <div className="evaluator-block__header">
                  <span className="evaluator-block__avatar">{row.evaluator.name.charAt(0)}</span>
                  <div>
                    <p className="evaluator-block__name">{row.evaluator.name}</p>
                    <p className="evaluator-block__count">{row.students.length} estudiantes asignados</p>
                  </div>
                </div>
                {row.students.length === 0 ? (
                  <p className="evaluator-block__empty">Sin estudiantes asignados</p>
                ) : (
                  <div className="evaluator-block__students">
                    {row.students.map(({ student, submission }) => {
                      const statusKey = submission ? submission.status : 'none';
                      const status = STATUS_CONFIG[statusKey];
                      return (
                        <div key={student.id} className="admin-student-row">
                          <span className="admin-student-row__name">{student.name}</span>
                          <span className={`badge ${status.cls}`}>{status.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* PESTAÑA INVESTIGADORES REGISTRADOS */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid var(--c-border)',
              boxShadow: 'var(--shadow-sm)',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--c-border)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 600, color: '#475569' }}>Nombre</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, color: '#475569' }}>Correo institucional</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, color: '#475569' }}>Proyectos Iniciados</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const researchers = users.filter(u => u.role === 'student');
                    if (researchers.length === 0) {
                      return (
                        <tr>
                          <td colSpan={3} style={{ padding: '24px', fontStyle: 'italic', color: '#64748b', textAlign: 'center' }}>
                            No hay investigadores registrados en la plataforma.
                          </td>
                        </tr>
                      );
                    }
                    return researchers.map(researcher => {
                      const docsCount = documentos.filter(d => d.investigadorId === researcher.id).length;
                      return (
                        <tr key={researcher.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--c-text)' }}>
                            {researcher.name}
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--c-text-muted)' }}>
                            {researcher.email}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {docsCount > 0 ? (
                              <button
                                type="button"
                                className="eval-btn eval-btn--sm eval-btn--primary"
                                onClick={() => {
                                  setSelectedResearcherForProjects(researcher);
                                  setExpandedProjectId(null);
                                }}
                                style={{ fontWeight: 600, padding: '4px 12px', fontSize: '12px' }}
                              >
                                Ver {docsCount} {docsCount === 1 ? 'proyecto' : 'proyectos'}
                              </button>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--c-text-subtle)', fontStyle: 'italic' }}>
                                Sin proyectos
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE EDICIÓN */}
      {editingDoc && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '600px', width: '100%', borderRadius: '12px' }}>
            <div className="modal__header">
              <h3 className="modal__title" style={{ fontWeight: 700 }}>Editar Proyecto ({editingDoc.codigo})</h3>
              <button className="modal__close" onClick={() => setEditingDoc(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal__body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                <div className="modal__field">
                  <label className="modal__label">Título / Tema del Proyecto</label>
                  <input 
                    className="modal__input" 
                    value={editTema} 
                    onChange={e => setEditTema(e.target.value)} 
                    required 
                  />
                </div>
                
                <div className="modal__field">
                  <label className="modal__label">Descripción / Justificación</label>
                  <textarea 
                    className="modal__textarea" 
                    rows={4}
                    value={editDescripcion} 
                    onChange={e => setEditDescripcion(e.target.value)} 
                    required 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="modal__field">
                    <label className="modal__label">Riesgo Declarado</label>
                    <select 
                      className="modal__input" 
                      value={editRiesgoDeclarado} 
                      onChange={e => setEditRiesgoDeclarado(e.target.value as RiesgoTipo)}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="sin-riesgo">Sin Riesgo</option>
                      <option value="riesgo-minimo">Riesgo Mínimo</option>
                      <option value="riesgo-mayor">Riesgo Mayor</option>
                    </select>
                  </div>

                  <div className="modal__field">
                    <label className="modal__label">Riesgo Confirmado</label>
                    <select 
                      className="modal__input" 
                      value={editRiesgoConfirmado} 
                      onChange={e => setEditRiesgoConfirmado(e.target.value as RiesgoTipo | 'none')}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="none">No confirmado aún</option>
                      <option value="sin-riesgo">Sin Riesgo (Exento)</option>
                      <option value="riesgo-minimo">Riesgo Mínimo</option>
                      <option value="riesgo-mayor">Riesgo Mayor</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="modal__field">
                    <label className="modal__label">Estado del Trámite</label>
                    <select 
                      className="modal__input" 
                      value={editEstado} 
                      onChange={e => setEditEstado(e.target.value as DocumentoEstado)}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="creada">Borrador</option>
                      <option value="estratificacion">Estratificación (Etapa 2)</option>
                      <option value="revision-tecnica">Evaluación Técnica (Etapa 3)</option>
                      <option value="aprobada">Aprobado</option>
                      <option value="anulada">Anulado / Suspendido</option>
                    </select>
                  </div>

                  <div className="modal__field">
                    <label className="modal__label">Evaluador Asignado</label>
                    <select 
                      className="modal__input" 
                      value={editEvaluadorId} 
                      onChange={e => setEditEvaluadorId(e.target.value)}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="">-- Sin asignar --</option>
                      {users.filter(u => u.role === 'evaluator').map(ev => {
                        const hasConflict = editingDoc.miembrosCeishDeclarados.includes(ev.id);
                        return (
                          <option key={ev.id} value={ev.id}>
                            {ev.name} {hasConflict ? ' (⚠️ Conflicto)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {editEvaluadorId && editingDoc.miembrosCeishDeclarados.includes(editEvaluadorId) && (
                  <div style={{
                    background: 'var(--c-danger-bg)',
                    color: 'var(--c-danger-text)',
                    border: '1px solid var(--c-danger-border)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '8px'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <div>
                      <strong>Alerta de Conflicto:</strong> El revisor seleccionado tiene un conflicto de interés declarado o coincide con la autoría del proyecto. Se recomienda reasignar a otro revisor.
                    </div>
                  </div>
                )}
              </div>
              <div className="modal__footer">
                <button type="button" className="eval-btn eval-btn--outline" onClick={() => setEditingDoc(null)}>Cancelar</button>
                <button type="submit" className="eval-btn eval-btn--primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Proyectos de un Investigador */}
      {selectedResearcherForProjects && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setSelectedResearcherForProjects(null); }}>
          <div className="modal" style={{ maxWidth: '650px', width: '100%', borderRadius: '12px' }}>
            <div className="modal__header">
              <h3 className="modal__title" style={{ fontWeight: 700 }}>
                Proyectos de {selectedResearcherForProjects.name}
              </h3>
              <button className="modal__close" onClick={() => setSelectedResearcherForProjects(null)}>✕</button>
            </div>
            <div className="modal__body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                const projects = documentos.filter(d => d.investigadorId === selectedResearcherForProjects.id);
                if (projects.length === 0) {
                  return (
                    <p style={{ fontStyle: 'italic', color: '#64748b', textAlign: 'center', margin: '20px 0' }}>
                      Este investigador no tiene proyectos iniciados.
                    </p>
                  );
                }
                return projects.map((project) => {
                  const isExpanded = expandedProjectId === project.id;
                  const activeAsig = asignaciones.find(a => a.documentoId === project.id && a.active);
                  const evaluator = activeAsig ? users.find(u => u.id === activeAsig.evaluadorId) : null;

                  return (
                    <div 
                      key={project.id} 
                      style={{ 
                        background: '#f8fafc', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '8px', 
                        overflow: 'hidden',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      {/* Cabecera del Proyecto (Click para expandir) */}
                      <div 
                        onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                        style={{ 
                          padding: '12px 16px', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          cursor: 'pointer',
                          background: isExpanded ? '#eff6ff' : '#f8fafc',
                          borderBottom: isExpanded ? '1px solid #bfdbfe' : 'none'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: '12px', textAlign: 'left' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                            {project.codigo}
                          </span>
                          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e293b', lineHeight: '1.3', display: 'block' }}>
                            {project.tema}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                          {getEstadoBadge(project.estado)}
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            style={{ 
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                              transition: 'transform 0.2s', 
                              color: '#64748b' 
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </div>

                      {/* Cuerpo del Proyecto (Desplegable) */}
                      {isExpanded && (
                        <div style={{ padding: '16px', background: 'white', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px', borderTop: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <div>
                            <h5 style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                              Descripción del Proyecto
                            </h5>
                            <p style={{ margin: 0, color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                              {project.descripcion || 'Sin descripción detallada.'}
                            </p>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                            <div>
                              <h5 style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                                Riesgo
                              </h5>
                              <span>{getRiesgoBadge(project.riesgoDeclarado)}</span>
                            </div>
                            <div>
                              <h5 style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                                Evaluador Asignado
                              </h5>
                              <span style={{ fontWeight: 500, color: '#1e293b' }}>
                                {evaluator ? evaluator.name : 'No asignado'}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
                            <span>Creado el: {new Date(project.createdAt).toLocaleDateString()}</span>
                            <button
                              type="button"
                              className="eval-btn eval-btn--sm eval-btn--outline"
                              onClick={() => {
                                setSelectedResearcherForProjects(null);
                                setEditingDoc(project);
                                setEditTema(project.tema);
                                setEditDescripcion(project.descripcion);
                                setEditRiesgoDeclarado(project.riesgoDeclarado);
                                setEditRiesgoConfirmado(project.riesgoConfirmado || 'none');
                                setEditEstado(project.estado);
                                const activeAsig = asignaciones.find(a => a.documentoId === project.id && a.active);
                                setEditEvaluadorId(activeAsig ? activeAsig.evaluadorId : '');
                              }}
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                            >
                              Editar Proyecto
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            <div className="modal__footer">
              <button type="button" className="eval-btn eval-btn--outline" onClick={() => setSelectedResearcherForProjects(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
