import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useCeishStore } from '../../store/ceishStore';
import { ceishService } from '../../services/ceishService';
import { CrearInvestigacionModal } from './components/CrearInvestigacionModal';
import { generateDocx } from '../../utils/docxGenerator';
import { resolverDependenciasAnexo } from '../../shared/utils/anexoDependencies';
import type { ValorCampo, Documento } from '../../shared/types/platform.types';
import './student.css';

export function SubmissionPage() {
  const currentUser = useAuthStore((s) => s.currentUser)!;
  const { 
    documentos, 
    asignaciones, 
    respuestasAnexos, 
    anexosTemplates, 
    tiposDocumento, 
    solicitarRevision,
    guardarRespuestaAnexo,
    subirCorreccion
  } = useCeishStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [filtroTab, setFiltroTab] = useState<'todos' | 'devueltos'>('todos');

  // Estados para el llenado dinámico de anexos en la Etapa 1
  const [activeAnexoId, setActiveAnexoId] = useState<string | null>(null);
  const [respuestasForm, setRespuestasForm] = useState<Record<string, any>>({});

  // Estados para la subida de corrección
  const [correccionFile, setCorreccionFile] = useState<File | null>(null);
  const [correccionComentario, setCorreccionComentario] = useState('');
  const [correccionError, setCorreccionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtrar documentos del investigador
  const misDocumentos = documentos.filter((d) => d.investigadorId === currentUser.id);
  const selectedDoc = documentos.find((d) => d.id === selectedDocId);
  // Los Anexos 1-9 (Etapa 1) se llenan sobre la PRIMERA versión del archivo, sin importar
  // cuántas correcciones de PDF se suban después (subirCorreccion agrega versiones nuevas
  // para la etapa de revisión técnica, no para las respuestas de Etapa 1) — usar la última
  // versión aquí desvincularía silenciosamente las respuestas ya guardadas del investigador.
  const primeraVersionArchivo = selectedDoc?.versionesArchivo[0];

  // Cargar respuestas guardadas del anexo seleccionado en memoria local al cambiar de anexo o versión
  useEffect(() => {
    if (selectedDoc && activeAnexoId && primeraVersionArchivo) {
      const respGuardada = respuestasAnexos.find(
        r => r.documentoId === selectedDoc.id && r.anexoTemplateId === activeAnexoId && r.versionArchivoId === primeraVersionArchivo.id
      );

      const iniciales: Record<string, any> = {};
      const template = anexosTemplates.find(t => t.id === activeAnexoId);

      if (respGuardada) {
        respGuardada.valores.forEach(v => {
          iniciales[v.campoId] = v.valor;
        });
        // Inicializar cualquier pregunta nueva del template que no esté en la respuesta guardada
        template?.preguntas.forEach(p => {
          if (iniciales[p.id] === undefined) {
            iniciales[p.id] = p.tipo === 'checklist' ? false : p.tipo === 'archivo' ? null : p.tipo === 'seleccion-multiple' ? [] : '';
          }
        });
      } else {
        // Inicializar campos vacíos según la plantilla
        template?.preguntas.forEach(p => {
          iniciales[p.id] = p.tipo === 'checklist' ? false : p.tipo === 'archivo' ? null : '';
        });
      }
      setRespuestasForm(iniciales);
    }
  }, [activeAnexoId, selectedDocId, primeraVersionArchivo?.id, respuestasAnexos, anexosTemplates]);

  const handleDownloadWordTemplate = async (anexoId: string) => {
    const template = anexosTemplates.find(t => t.id === anexoId);
    if (!template) return;
    if (!template.wordTemplateObjectKey) {
      alert("Este anexo no tiene una plantilla de Word oficial asociada en el sistema.");
      return;
    }

    const dataToInject: Record<string, any> = {
      codigo: selectedDoc?.codigo || '',
      tema: selectedDoc?.tema || '',
      nombre_evaluador: 'Evaluador CEISH',
      fecha: new Date().toLocaleDateString('es-ES'),
      resultado: 'Solicitado',
      observaciones: 'Sin observaciones.',
    };

    template.preguntas.forEach(p => {
      const val = respuestasForm[p.id];
      const tag = p.key || `tag_${p.orden}`;
      
      if (p.tipo === 'checklist') {
        dataToInject[tag] = val ? 'SÍ' : '';
      } else if (p.tipo === 'si-no') {
        dataToInject[tag] = (val === 'SI' || val === true || val === 'true') ? 'SÍ' : (val === 'NO' || val === false || val === 'false') ? 'NO' : '';
      } else if (p.tipo === 'archivo') {
        dataToInject[tag] = val ? `Archivo adjunto: ${val.documentName}` : 'Sin archivo adjunto';
      } else if (p.tipo === 'seleccion-multiple') {
        dataToInject[tag] = Array.isArray(val) ? val.join(', ') : '';
      } else {
        dataToInject[tag] = val || '';
      }
    });

    const fileName = `Anexo_${template.numero}_${selectedDoc?.codigo || 'CEISH'}`;
    try {
      const bytes = await ceishService.fetchFileBytes(template.wordTemplateObjectKey);
      generateDocx(bytes, dataToInject, fileName);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al descargar la plantilla de Word.');
    }
  };

  // Autoseleccionar la primera pestaña de anexo al abrir un documento — los Anexos 1-9
  // siguen editables mientras el trámite no esté cerrado (aprobada/anulada), no solo en 'creada'.
  useEffect(() => {
    if (selectedDoc && selectedDoc.estado !== 'aprobada' && selectedDoc.estado !== 'anulada') {
      const tipoDoc = tiposDocumento.find(t => t.id === selectedDoc.tipoDocumentoId);
      const etapaCreacion = tipoDoc?.secciones[0];
      if (etapaCreacion && etapaCreacion.anexos.length > 0) {
        setActiveAnexoId(etapaCreacion.anexos[0].anexoTemplateId);
      }
    } else {
      setActiveAnexoId(null);
    }
    // Limpiar campos de corrección
    setCorreccionFile(null);
    setCorreccionComentario('');
    setCorreccionError(null);
  }, [selectedDocId]);

  // Acción para solicitar revisión
  const handleSolicitarRevision = async (id: string) => {
    try {
      await solicitarRevision(id, currentUser.name);
      window.alert('Solicitud de revisión enviada con éxito. Se ha asignado un revisor aleatorio (ciego) de manera automática.');
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  // Guardar respuestas de un anexo de Etapa 1
  const handleGuardarAnexo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !activeAnexoId || !primeraVersionArchivo) return;

    const valores: ValorCampo[] = Object.keys(respuestasForm).map(key => ({
      campoId: key,
      valor: respuestasForm[key]
    }));

    const tipoDoc = tiposDocumento.find(t => t.id === selectedDoc.tipoDocumentoId);
    const seccionId = tipoDoc?.secciones[0]?.id || 'sec-creacion';

    try {
      await guardarRespuestaAnexo({
        anexoTemplateId: activeAnexoId,
        documentoId: selectedDoc.id,
        seccionId,
        versionArchivoId: primeraVersionArchivo.id,
        emitidoPorId: currentUser.id,
        emitidoPorNombre: currentUser.name,
        valores,
        comentariosAnotados: []
      });
      window.alert('Borrador del anexo guardado con éxito.');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al guardar el borrador del anexo.');
    }
  };

  // Subir un PDF de corrección
  const handleEnviarCorreccion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !correccionFile) return;

    try {
      // El comentario del investigador se anexa al historial dentro de la misma
      // transacción del servidor (subirCorreccion), sin una segunda escritura aparte.
      await subirCorreccion(selectedDoc.id, correccionFile, currentUser.name, correccionComentario);
      window.alert('Correcciones enviadas con éxito. El revisor ha sido notificado para evaluar el nuevo archivo.');
      setCorreccionFile(null);
      setCorreccionComentario('');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al enviar la corrección.');
    }
  };

  // Visualizar el archivo almacenado en MinIO
  const handleVerArchivo = (versionPath: string) => {
    window.open(ceishService.getFileRawUrl(versionPath), '_blank', 'noopener,noreferrer');
  };

  // Renderizar badge de estado
  const renderEstadoBadge = (estado: string) => {
    const badges: Record<string, { text: string; className: string }> = {
      creada: { text: 'Borrador (Falta Llenar Anexos)', className: 'eval-badge eval-badge--pending' },
      estratificacion: { text: 'Etapa 1: Estratificación', className: 'eval-badge eval-badge--in-progress' },
      'revision-tecnica': { text: 'Etapa 2: Revisión Técnica', className: 'eval-badge' },
      aprobada: { text: 'Aprobada (Exenta)', className: 'eval-badge eval-badge--success' },
      anulada: { text: 'Anulada / Suspendida', className: 'eval-badge eval-badge--rejected' },
    };

    const badge = badges[estado] || { text: estado, className: 'eval-badge' };
    return <span className={badge.className}>{badge.text}</span>;
  };

  const getAsignacionActiva = (docId: string) => {
    return asignaciones.find((a) => a.documentoId === docId && a.active);
  };

  const getEmisionesDoc = (docId: string) => {
    return respuestasAnexos.filter((ae) => ae.documentoId === docId);
  };

  // Verificar si un anexo ya fue guardado
  const isAnexoCompletado = (anexoId: string) => {
    if (!selectedDoc || !primeraVersionArchivo) return false;
    return respuestasAnexos.some(
      r => r.documentoId === selectedDoc.id && r.anexoTemplateId === anexoId && r.versionArchivoId === primeraVersionArchivo.id
    );
  };

  // Calcular si todos los anexos obligatorios de Etapa 1 están completados
  const isEtapa1Completa = () => {
    if (!selectedDoc) return false;
    const tipoDoc = tiposDocumento.find(t => t.id === selectedDoc.tipoDocumentoId);
    const etapaCreacion = tipoDoc?.secciones[0];
    if (!etapaCreacion) return false;

    // Retorna true si todos los anexos de la sección marcados como obligatorio están completados
    return etapaCreacion.anexos
      .filter(an => an.obligatorio)
      .every(an => isAnexoCompletado(an.anexoTemplateId));
  };

  const getAnexosPendientesNombres = () => {
    if (!selectedDoc) return [];
    const tipoDoc = tiposDocumento.find(t => t.id === selectedDoc.tipoDocumentoId);
    const etapaCreacion = tipoDoc?.secciones[0];
    if (!etapaCreacion) return [];

    return etapaCreacion.anexos
      .filter(an => an.obligatorio && !isAnexoCompletado(an.anexoTemplateId))
      .map(an => {
        const temp = anexosTemplates.find(t => t.id === an.anexoTemplateId);
        return temp ? `Anexo ${temp.numero}` : 'Anexo';
      });
  };

  // Obtener la última evaluación técnica (Anexo 12) emitida para un documento
  const getUltimoAnexo12EmitidoPara = (docId: string) => {
    const emisiones = respuestasAnexos.filter(
      r => r.documentoId === docId && r.anexoTemplateId === 'anexo-12'
    );
    if (emisiones.length === 0) return null;
    return emisiones.sort((a, b) => new Date(b.emitidoAt).getTime() - new Date(a.emitidoAt).getTime())[0];
  };

  const ultimoA12 = selectedDoc ? getUltimoAnexo12EmitidoPara(selectedDoc.id) : null;
  const tieneObservacionesPendientes = selectedDoc?.estado === 'revision-tecnica' && ultimoA12?.resultado === 'con-observaciones';

  // Un documento cuenta como "devuelto para cambios" si: volvió a borrador tras
  // haber sido enviado antes (más de 1 entrada de historial), o si su última
  // evaluación técnica (Anexo 12) para la versión vigente tiene observaciones.
  const esDevuelto = (doc: Documento) => {
    if (doc.estado === 'creada' && doc.historialEstados.length > 1) return true;
    if (doc.estado === 'revision-tecnica') {
      const a12 = getUltimoAnexo12EmitidoPara(doc.id);
      const latest = doc.versionesArchivo.slice(-1)[0];
      return a12?.resultado === 'con-observaciones' && a12.versionArchivoId === latest?.id;
    }
    return false;
  };

  const misDocumentosFiltrados = filtroTab === 'todos' ? misDocumentos : misDocumentos.filter(esDevuelto);

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

      <div className="page__body" style={{ display: 'grid', gridTemplateColumns: selectedDoc ? '1fr 400px' : '1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Tabla / Lista de Investigaciones */}
        <div className="card" style={{ padding: '20px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div className="eval-tabs" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '16px', display: 'flex', gap: '6px' }}>
            <button
              className={`eval-tabs__btn ${filtroTab === 'todos' ? 'active' : ''}`}
              onClick={() => setFiltroTab('todos')}
              style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Todos ({misDocumentos.length})
            </button>
            <button
              className={`eval-tabs__btn ${filtroTab === 'devueltos' ? 'active' : ''}`}
              onClick={() => setFiltroTab('devueltos')}
              style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Devueltos para Cambios ({misDocumentos.filter(esDevuelto).length})
            </button>
          </div>
          {misDocumentosFiltrados.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-state__icon" style={{ margin: '0 auto 16px auto' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v13a2 2 0 01-2 2z" stroke="#94a3b8" strokeWidth="1.5" />
                  <path d="M12 11v6M9 14h6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="empty-state__title">
                {filtroTab === 'devueltos' ? 'No tienes proyectos devueltos para cambios' : 'No tienes investigaciones registradas'}
              </h2>
              <p className="empty-state__desc" style={{ maxWidth: '400px', margin: '8px auto 16px auto', color: '#64748b' }}>
                {filtroTab === 'devueltos'
                  ? 'Aquí aparecerán los proyectos que un evaluador o el CEISH devuelva con observaciones o cambios a realizar.'
                  : 'Comience registrando su protocolo de investigación y completando la ficha de anexos requeridos para solicitar la revisión.'}
              </p>
              {filtroTab === 'todos' && (
                <button className="eval-btn eval-btn--primary" onClick={() => setModalOpen(true)}>
                  Registrar Proyecto
                </button>
              )}
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
                {misDocumentosFiltrados.map((doc) => (
                  <tr 
                    key={doc.id} 
                    onClick={() => setSelectedDocId(doc.id)}
                    style={{ 
                      borderBottom: '1px solid #f1f5f9', 
                      cursor: 'pointer', 
                      background: selectedDocId === doc.id ? '#f8fafc' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                    className="hover-row"
                  >
                    <td style={{ padding: '14px 8px', fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                      {doc.codigo}
                    </td>
                    <td style={{ padding: '14px 8px' }}>
                      <p style={{ fontWeight: 500, fontSize: '14px', margin: 0, color: '#0f172a' }}>{doc.tema}</p>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>
                        Creado: {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td style={{ padding: '14px 8px', fontSize: '13px', textTransform: 'capitalize' }}>
                      {doc.riesgoDeclarado.replace('-', ' ')}
                    </td>
                    <td style={{ padding: '14px 8px' }}>
                      {renderEstadoBadge(doc.estado)}
                    </td>
                    <td style={{ padding: '14px 8px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          className="eval-btn eval-btn--outline"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setSelectedDocId(doc.id === selectedDocId ? null : doc.id)}
                        >
                          {selectedDocId === doc.id ? 'Cerrar Detalle' : 'Ver Detalle'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Panel lateral de Detalle / Gestión Dinámica de Anexos */}
        {selectedDoc && (
          <div className="card" style={{ padding: '20px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Detalle de Proyecto</h3>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{selectedDoc.codigo}</span>
              </div>
              <button 
                onClick={() => setSelectedDocId(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600 }}>Título / Tema</p>
              <h4 style={{ margin: 0, fontSize: '14px', color: '#192231', fontWeight: 600 }}>{selectedDoc.tema}</h4>
            </div>

            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600 }}>Resumen</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>{selectedDoc.descripcion}</p>
            </div>

            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600 }}>Autores</p>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#334155' }}>
                {selectedDoc.autores.map((a, i) => (
                  <li key={i}>
                    {a.nombre || `Cédula: ${a.cedula}`} {i === 0 && <strong style={{ color: '#2563eb', fontSize: '11px' }}>(Principal)</strong>}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600 }}>Documentos Cargados</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {selectedDoc.versionesArchivo.map((v, index) => (
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
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.documentName}>
                        v{index + 1}: {v.documentName}
                      </p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                        {new Date(v.uploadedAt).toLocaleDateString()} {v.comment ? `· "${v.comment}"` : ''}
                      </p>
                    </div>
                    <button 
                      className="eval-btn eval-btn--outline" 
                      style={{ padding: '3px 8px', fontSize: '11px', flexShrink: 0 }}
                      onClick={() => handleVerArchivo(v.documentPath)}
                    >
                      Ver PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* FASE 2: TAREA 2.3 - SUBIDA DE CORRECCIONES EN RONDAS */}
            {tieneObservacionesPendientes && (
              <form onSubmit={handleEnviarCorreccion} style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '12px', color: '#854d0e', fontWeight: 700, margin: 0 }}>
                  ⚠️ Observaciones Técnicas Pendientes
                </p>
                <p style={{ fontSize: '11px', color: '#713f12', margin: 0 }}>
                  Su revisión metodológica actual (Anexo 12) tiene observaciones. Suba una nueva versión de su PDF con las correcciones integradas.
                </p>

                {selectedDoc.cronometro?.fechaLimiteCorreccion && (() => {
                  const fechaLimite = selectedDoc.cronometro!.fechaLimiteCorreccion!;
                  const vencido = new Date() > new Date(fechaLimite);
                  return (
                    <p style={{ fontSize: '11px', fontWeight: 700, margin: 0, color: vencido ? '#991b1b' : '#854d0e' }}>
                      {vencido
                        ? `⚠️ Plazo vencido (venció el ${new Date(fechaLimite).toLocaleDateString('es-ES')}). Su proyecto puede ser anulado por incumplimiento.`
                        : `⏳ Tiene hasta el ${new Date(fechaLimite).toLocaleDateString('es-ES')} para subir su corrección.`}
                    </p>
                  );
                })()}

                {ultimoA12 && ultimoA12.comentariosAnotados.length > 0 && (
                  <div style={{ background: 'white', padding: '8px', borderRadius: '6px', border: '1px solid #fcd34d', maxHeight: '100px', overflowY: 'auto' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#451a03', margin: '0 0 4px 0' }}>Señalamientos específicos por página:</p>
                    <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '10px', color: '#78350f' }}>
                      {ultimoA12.comentariosAnotados.map((c) => (
                        <li key={c.id}>
                          <strong>Pág. {c.paginaPdf}:</strong> "{c.texto}"
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '1.5px dashed #d97706',
                    borderRadius: '6px',
                    padding: '12px',
                    textAlign: 'center',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#b45309',
                    fontWeight: 600
                  }}
                >
                  {correccionFile ? `✓ ${correccionFile.name}` : '+ Seleccionar PDF Corregido'}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f && f.type === 'application/pdf') {
                      setCorreccionFile(f);
                      setCorreccionError(null);
                    } else {
                      setCorreccionError('Seleccione un archivo PDF válido.');
                    }
                  }}
                  style={{ display: 'none' }}
                />

                <textarea
                  className="form-input"
                  placeholder="Detalle sus comentarios sobre las correcciones realizadas..."
                  rows={2}
                  value={correccionComentario}
                  onChange={(e) => setCorreccionComentario(e.target.value)}
                  style={{ fontSize: '11px', background: 'white' }}
                  required
                />

                {correccionError && (
                  <p style={{ fontSize: '10px', color: '#dc2626', margin: 0 }}>{correccionError}</p>
                )}

                <button
                  type="submit"
                  className="eval-btn eval-btn--primary"
                  style={{ fontSize: '12px', padding: '6px' }}
                  disabled={!correccionFile || !correccionComentario.trim()}
                >
                  Enviar Archivo Corregido
                </button>
              </form>
            )}

            {/* FASE 2: TAREA 2.2 - LLENADO DINÁMICO DE ANEXOS (ETAPA 1: CREACIÓN).
                Sigue disponible más allá de 'creada' para poder corregir una respuesta ya
                enviada mientras el trámite no esté cerrado (aprobada/anulada); el evaluador
                activo recibe una notificación con el detalle de qué cambió. */}
            {selectedDoc.estado !== 'aprobada' && selectedDoc.estado !== 'anulada' && (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', fontWeight: 600 }}>
                  Fichas de Anexos Técnicos (Etapa 1){selectedDoc.estado !== 'creada' ? ' — Edición de respuesta ya enviada' : ''}
                </p>

                {/* Lista de pestañas de anexos configurados */}
                <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '12px' }}>
                  {(() => {
                    const tipoDoc = tiposDocumento.find(t => t.id === selectedDoc.tipoDocumentoId);
                    const etapaCreacion = tipoDoc?.secciones[0];
                    if (!etapaCreacion || !tipoDoc) return null;
                    const todosAnexosTipo = tipoDoc.secciones.flatMap(s => s.anexos);

                    return etapaCreacion.anexos.map(an => {
                      const temp = anexosTemplates.find(t => t.id === an.anexoTemplateId);
                      if (!temp) return null;
                      const compl = isAnexoCompletado(temp.id);
                      const { desbloqueado, faltantes } = resolverDependenciasAnexo(
                        temp.id, todosAnexosTipo, respuestasAnexos, selectedDoc.id, primeraVersionArchivo?.id,
                      );
                      const faltantesTxt = faltantes
                        .map(id => anexosTemplates.find(t => t.id === id))
                        .filter((t): t is NonNullable<typeof t> => !!t)
                        .map(t => `Anexo ${t.numero}`)
                        .join(', ');

                      return (
                        <button
                          key={temp.id}
                          onClick={() => desbloqueado && setActiveAnexoId(temp.id)}
                          disabled={!desbloqueado}
                          title={desbloqueado ? undefined : `Debe completar primero: ${faltantesTxt}`}
                          style={{
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid',
                            borderColor: activeAnexoId === temp.id ? '#2563eb' : '#cbd5e1',
                            background: activeAnexoId === temp.id ? '#eff6ff' : 'white',
                            color: activeAnexoId === temp.id ? '#2563eb' : '#334155',
                            cursor: desbloqueado ? 'pointer' : 'not-allowed',
                            opacity: desbloqueado ? 1 : 0.5,
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          Anexo {temp.numero}
                          <span>{!desbloqueado ? '🔒' : compl ? '✅' : '⏳'}</span>
                        </button>
                      );
                    });
                  })()}
                </div>

                {/* Formulario Dinámico para el Anexo Activo */}
                {activeAnexoId && (() => {
                  const template = anexosTemplates.find(t => t.id === activeAnexoId);
                  if (!template) return null;

                  return (
                    <form onSubmit={handleGuardarAnexo} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h5 style={{ margin: 0, fontSize: '13px', color: '#1e293b', flex: 1 }}>
                          Anexo {template.numero} - {template.nombre}
                        </h5>
                        {template.wordTemplateObjectKey && (
                          <button
                            type="button"
                            className="eval-btn eval-btn--sm eval-btn--primary"
                            onClick={() => handleDownloadWordTemplate(template.id)}
                            style={{ fontSize: '11px', padding: '4px 8px', marginLeft: '10px' }}
                          >
                            📥 Descargar Word Relleno
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {template.preguntas.map(p => (
                          <div key={p.id} className="form-group">
                            {p.descripcionContexto && (
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>
                                [{p.descripcionContexto}]
                              </span>
                            )}
                            <label className="form-label" style={{ fontSize: '12px', lineHeight: '1.4' }}>{p.texto}</label>

                            {p.tipo === 'texto-libre' ? (
                              <textarea
                                className="form-input"
                                value={respuestasForm[p.id] || ''}
                                onChange={(e) => setRespuestasForm({ ...respuestasForm, [p.id]: e.target.value })}
                                rows={2}
                                style={{ fontSize: '12px', background: 'white' }}
                                required
                              />
                            ) : p.tipo === 'archivo' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                                <input
                                  type="file"
                                  accept=".pdf,application/pdf,image/*"
                                  onChange={async (e) => {
                                    const f = e.target.files?.[0] || null;
                                    if (!f) return;
                                    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
                                    const isImage = f.type.startsWith('image/');
                                    if (!isPdf && !isImage) {
                                      window.alert('Solo se permiten archivos en formato PDF o imagen.');
                                      return;
                                    }
                                    try {
                                      const { documentPath } = await ceishService.uploadFile(f);
                                      setRespuestasForm({ ...respuestasForm, [p.id]: { documentName: f.name, documentPath } });
                                    } catch (err) {
                                      window.alert(err instanceof Error ? err.message : 'Error al subir el archivo.');
                                    }
                                  }}
                                  style={{ fontSize: '12px' }}
                                />
                                {respuestasForm[p.id]?.documentName && (
                                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                                    ✓ Archivo adjunto: {respuestasForm[p.id].documentName}
                                  </span>
                                )}
                              </div>
                            ) : p.tipo === 'si-no' ? (
                              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => setRespuestasForm({ ...respuestasForm, [p.id]: 'SI' })}
                                  style={{
                                    padding: '6px 16px',
                                    borderRadius: '20px',
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: respuestasForm[p.id] === 'SI' ? '#10b981' : '#f8fafc',
                                    color: respuestasForm[p.id] === 'SI' ? 'white' : '#475569',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  Sí
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRespuestasForm({ ...respuestasForm, [p.id]: 'NO' })}
                                  style={{
                                    padding: '6px 16px',
                                    borderRadius: '20px',
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: respuestasForm[p.id] === 'NO' ? '#ef4444' : '#f8fafc',
                                    color: respuestasForm[p.id] === 'NO' ? 'white' : '#475569',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  No
                                </button>
                              </div>
                            ) : p.tipo === 'seleccion-unica' ? (
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                {(p.opciones ?? []).map(op => (
                                  <button
                                    key={op}
                                    type="button"
                                    onClick={() => setRespuestasForm({ ...respuestasForm, [p.id]: op })}
                                    style={{
                                      padding: '6px 16px',
                                      borderRadius: '20px',
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: respuestasForm[p.id] === op ? '#3b82f6' : '#f8fafc',
                                      color: respuestasForm[p.id] === op ? 'white' : '#475569',
                                      fontWeight: 600,
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                    }}
                                  >
                                    {op}
                                  </button>
                                ))}
                              </div>
                            ) : p.tipo === 'seleccion-multiple' ? (
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                {(p.opciones ?? []).map(op => {
                                  const arr = Array.isArray(respuestasForm[p.id]) ? respuestasForm[p.id] : [];
                                  const active = arr.includes(op);
                                  return (
                                    <button
                                      key={op}
                                      type="button"
                                      onClick={() => setRespuestasForm({ ...respuestasForm, [p.id]: active ? arr.filter((o: string) => o !== op) : [...arr, op] })}
                                      style={{
                                        padding: '6px 16px',
                                        borderRadius: '20px',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: active ? '#3b82f6' : '#f8fafc',
                                        color: active ? 'white' : '#475569',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                      }}
                                    >
                                      {active ? '✓ ' : ''}{op}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <label className="checkbox-label" style={{ marginTop: '2px' }}>
                                <input
                                  type="checkbox"
                                  checked={!!respuestasForm[p.id]}
                                  onChange={(e) => setRespuestasForm({ ...respuestasForm, [p.id]: e.target.checked })}
                                />
                                <span style={{ fontSize: '12px' }}>Marcar declaratoria</span>
                              </label>
                            )}
                          </div>
                        ))}
                      </div>

                      <button type="submit" className="eval-btn eval-btn--primary" style={{ fontSize: '11px', padding: '6px', width: 'fit-content' }}>
                        Guardar Borrador Anexo
                      </button>
                    </form>
                  );
                })()}
              </div>
            )}

            {/* Estado de Asignación Ciega (Si aplica) */}
            {selectedDoc.estado !== 'creada' && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '6px' }}>
                <p style={{ fontSize: '11px', color: '#166534', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600 }}>Revisión CEISH</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#14532d' }}>
                  {getAsignacionActiva(selectedDoc.id) 
                    ? 'Evaluador asignado. Evaluación en curso de forma ciega y confidencial.' 
                    : selectedDoc.estado === 'aprobada' 
                      ? 'Revisión finalizada: Proyecto Aprobado.' 
                      : selectedDoc.estado === 'anulada'
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
                {selectedDoc.historialEstados.map((h, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <div style={{ 
                      position: 'absolute', 
                      left: '-21px', 
                      top: '4px', 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      background: idx === selectedDoc.historialEstados.length - 1 ? '#2563eb' : '#94a3b8',
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
            {getEmisionesDoc(selectedDoc.id).length > 0 && (
              <div>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', fontWeight: 600 }}>Anexos Emitidos</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getEmisionesDoc(selectedDoc.id)
                    .sort((a, b) => new Date(b.emitidoAt).getTime() - new Date(a.emitidoAt).getTime())
                    .map((em) => {
                      const template = anexosTemplates.find(t => t.id === em.anexoTemplateId);
                      if (!template) return null;

                      return (
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
                              Anexo {template.numero} - {template.nombre}
                            </span>
                            <span className={`eval-badge ${em.resultado === 'aprobado' || em.resultado === 'coincide' ? 'eval-badge--success' : 'eval-badge--rejected'}`} style={{ fontSize: '10px' }}>
                              {em.resultado === 'coincide' ? 'Exento (Coincide)' : em.resultado}
                            </span>
                          </div>
                          <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>
                            Emitido el: {new Date(em.emitidoAt).toLocaleDateString()} por {em.emitidoPorNombre}
                          </p>
                          
                          {/* Mostrar justificación o comentarios del anexo emitido */}
                          {em.valores.map((val) => {
                            const pregunta = em.snapshotPreguntas.find(p => p.id === val.campoId);
                            if (pregunta && pregunta.tipo === 'texto-libre' && val.valor) {
                              return (
                                <div key={val.campoId} style={{ marginTop: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
                                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 500, color: '#475569' }}>Observación/Justificación:</p>
                                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                                    "{val.valor}"
                                  </p>
                                </div>
                              );
                            }
                            if (pregunta && pregunta.tipo === 'archivo' && val.valor?.documentName) {
                              return (
                                <div key={val.campoId} style={{ marginTop: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                  <p style={{ margin: 0, fontSize: '11px', color: '#475569' }}>📎 {val.valor.documentName}</p>
                                  <button
                                    type="button"
                                    className="eval-btn eval-btn--outline"
                                    style={{ padding: '2px 8px', fontSize: '10.5px' }}
                                    onClick={() => handleVerArchivo(val.valor.documentPath)}
                                  >
                                    Ver
                                  </button>
                                </div>
                              );
                            }
                            if (pregunta && pregunta.tipo === 'seleccion-unica' && val.valor) {
                              return (
                                <div key={val.campoId} style={{ marginTop: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
                                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 500, color: '#475569' }}>{pregunta.texto}:</p>
                                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>{val.valor}</p>
                                </div>
                              );
                            }
                            if (pregunta && pregunta.tipo === 'seleccion-multiple' && Array.isArray(val.valor) && val.valor.length > 0) {
                              return (
                                <div key={val.campoId} style={{ marginTop: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
                                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 500, color: '#475569' }}>{pregunta.texto}:</p>
                                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>{val.valor.join(', ')}</p>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Enviar Solicitud de Revisión Ética (Borrador Etapa 1 listo) */}
            {selectedDoc.estado === 'creada' && (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {isEtapa1Completa() ? (
                  <>
                    <p style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, margin: 0 }}>
                      ✓ Todos los anexos obligatorios completados. Proyecto listo para revisión.
                    </p>
                    <button
                      className="eval-btn eval-btn--primary"
                      style={{ width: '100%' }}
                      onClick={() => handleSolicitarRevision(selectedDoc.id)}
                    >
                      Solicitar Revisión Ética
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, margin: 0 }}>
                      ⚠️ Anexos obligatorios pendientes: {getAnexosPendientesNombres().join(', ')}
                    </p>
                    <button
                      className="eval-btn eval-btn--primary"
                      style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }}
                      disabled
                    >
                      Solicitar Revisión Ética
                    </button>
                  </>
                )}
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
