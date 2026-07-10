import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useCeishStore } from '../../../store/ceishStore';
import { ceishFileCache } from '../../../store/fileCache';
import { usePDFViewer } from '../../evaluation/hooks/usePDFViewer';
import { PDFViewer } from '../../evaluation/components/PDFViewer/PDFViewer';
import type { 
  ValorCampo, 
  ComentarioAnotacion,
  RiesgoTipo
} from '../../../shared/types/platform.types';
import '../../evaluation/evaluation.css';
import '../evaluator.css';

type Tab = 'info' | 'evaluacion-dinamica' | 'investigador-llenado';

export function ReviewCeishPage() {
  const { investigacionId = '' } = useParams<{ investigacionId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser)!;

  const { 
    documentos, 
    anexosTemplates, 
    tiposDocumento, 
    respuestasAnexos, 
    emitirAnexo, 
    guardarRespuestaAnexo, 
    darseDeBajaRevisor,
    crearEscalamiento 
  } = useCeishStore();

  const documento = documentos.find((d) => d.id === investigacionId);

  // Estados locales para la pestaña activa en el panel derecho
  const [activeTab, setActiveTab] = useState<Tab>('evaluacion-dinamica');
  // Anexo activo dentro de la etapa
  const [activeAnexoId, setActiveAnexoId] = useState<string | null>(null);

  // Respuestas locales para el formulario dinámico del anexo activo
  const [respuestasForm, setRespuestasForm] = useState<Record<string, any>>({});

  // Estados locales para las anotaciones por página del PDF (Fase 3)
  const [anotaciones, setAnotaciones] = useState<ComentarioAnotacion[]>([]);
  const [nuevoComentarioTexto, setNuevoComentarioTexto] = useState('');

  // Modales y comentarios de control especial
  const [showConflictoModal, setShowConflictoModal] = useState(false);
  const [conflictoComentario, setConflictoComentario] = useState('');
  
  const [showDevolverModal, setShowDevolverModal] = useState(false);
  const [devolucionComentario, setDevolucionComentario] = useState('');

  const [showEscalarModal, setShowEscalarModal] = useState(false);
  const [escalamientoComentario, setEscalamientoComentario] = useState('');

  const [nuevoRiesgoEleccion, setNuevoRiesgoEleccion] = useState<RiesgoTipo>('riesgo-minimo');

  // Visor PDF
  const pdf = usePDFViewer();
  const { loadFile } = pdf;
  const latestVersion = documento?.versionesArchivo.slice(-1)[0];
  const fileObj = latestVersion ? ceishFileCache[latestVersion.documentPath] : null;

  useEffect(() => {
    if (fileObj) {
      loadFile(fileObj);
    }
  }, [fileObj, loadFile]);

  // Regla de Reset de Estado al cargar una nueva investigación o versión de archivo
  useEffect(() => {
    setAnotaciones([]);
    setNuevoComentarioTexto('');
    setDevolucionComentario('');
    setConflictoComentario('');
    setEscalamientoComentario('');
    setRespuestasForm({});
  }, [investigacionId, latestVersion?.id]);

  // Si no se encuentra el documento
  if (!documento) {
    return (
      <div className="eval-loading">
        <h2>Trámite no encontrado</h2>
        <button className="eval-btn eval-btn--primary" onClick={() => navigate('/evaluador')}>Volver al Dashboard</button>
      </div>
    );
  }

  // Obtener el tipo de documento configurado y la sección activa según el estado del trámite
  const tipoDoc = tiposDocumento.find((t) => t.id === documento.tipoDocumentoId);
  if (!tipoDoc) {
    return (
      <div className="eval-loading">
        <h2>Tipo de flujo no configurado en la plataforma</h2>
        <button className="eval-btn eval-btn--primary" onClick={() => navigate('/evaluador')}>Volver al Dashboard</button>
      </div>
    );
  }

  // Determinar dinámicamente la sección activa
  const activeSeccion = tipoDoc.secciones.find(s => {
    if (documento.estado === 'estratificacion') return s.id === 'sec-estratificacion';
    if (documento.estado === 'revision-tecnica') return s.id === 'sec-evaluacion';
    return false;
  }) || tipoDoc.secciones[1]; // Fallback a la segunda sección por seguridad

  // Autoseleccionar el primer anexo asignado a la sección
  if (!activeAnexoId && activeSeccion && activeSeccion.anexos.length > 0) {
    setActiveAnexoId(activeSeccion.anexos[0].anexoTemplateId);
  }

  // Cargar borrador/respuestas del anexo activo en memoria al cambiar de pestaña
  useEffect(() => {
    if (activeAnexoId && latestVersion) {
      const respGuardada = respuestasAnexos.find(
        r => r.documentoId === documento.id && r.anexoTemplateId === activeAnexoId && r.versionArchivoId === latestVersion.id
      );

      const iniciales: Record<string, any> = {};
      if (respGuardada) {
        respGuardada.valores.forEach(v => {
          iniciales[v.campoId] = v.valor;
        });
      } else {
        const template = anexosTemplates.find(t => t.id === activeAnexoId);
        template?.preguntas.forEach(p => {
          iniciales[p.id] = p.tipo === 'cumple-nocumple' || p.tipo === 'si-no' || p.tipo === 'checklist' ? false : '';
        });
      }
      setRespuestasForm(iniciales);
    }
  }, [activeAnexoId, latestVersion?.id]);

  // Cargar observaciones o respuestas a nivel de página del PDF para este anexo si ya fueron guardadas
  useEffect(() => {
    if (activeAnexoId && latestVersion) {
      const respGuardada = respuestasAnexos.find(
        r => r.documentoId === documento.id && r.anexoTemplateId === activeAnexoId && r.versionArchivoId === latestVersion.id
      );
      if (respGuardada) {
        setAnotaciones(respGuardada.comentariosAnotados.map(c => ({ ...c })));
      }
    }
  }, [activeAnexoId, latestVersion?.id]);

  // Manejar cambio de input en preguntas
  const handlePreguntaChange = (preguntaId: string, valor: any) => {
    setRespuestasForm(prev => ({ ...prev, [preguntaId]: valor }));
  };

  // Manejar adición de anotación por página del PDF (Fase 3)
  const handleAgregarAnotacion = () => {
    if (!nuevoComentarioTexto.trim()) return;

    const nuevaAnotacion: ComentarioAnotacion = {
      id: typeof window !== 'undefined' && window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
      texto: nuevoComentarioTexto.trim(),
      paginaPdf: pdf.currentPage,
      autorId: currentUser.id,
      autorNombre: currentUser.name,
      createdAt: new Date().toISOString()
    };

    setAnotaciones(prev => [...prev, nuevaAnotacion].sort((a, b) => (a.paginaPdf || 0) - (b.paginaPdf || 0)));
    setNuevoComentarioTexto('');
  };

  const handleEliminarAnotacion = (id: string) => {
    setAnotaciones(prev => prev.filter(a => a.id !== id));
  };

  // Guardar Borrador
  const handleGuardarBorrador = () => {
    if (!activeAnexoId || !latestVersion) return;

    const valores: ValorCampo[] = Object.keys(respuestasForm).map(key => ({
      campoId: key,
      valor: respuestasForm[key]
    }));

    guardarRespuestaAnexo({
      anexoTemplateId: activeAnexoId,
      documentoId: documento.id,
      seccionId: activeSeccion.id,
      versionArchivoId: latestVersion.id,
      emitidoPorId: currentUser.id,
      emitidoPorNombre: currentUser.name,
      valores,
      comentariosAnotados: anotaciones
    });

    window.alert('Respuestas y anotaciones de página guardadas en borrador.');
  };

  // ============================================================================
  // DISPARADORES DE ACCIÓN (Mapeados por Anexo ID en Estratificación)
  // ============================================================================

  // ACCIÓN 1: Confirmar Sin Riesgo (Emite Anexo 27 y Carta Exención Anexo 11)
  const handleConfirmarExencion = () => {
    const justificacionText = respuestasForm[Object.keys(respuestasForm).slice(-1)[0]] || '';
    if (!justificacionText.trim()) {
      return alert('Debe completar la justificación/criterio final del anexo de estratificación.');
    }

    const versionId = latestVersion?.id || '';
    const valoresA27: ValorCampo[] = Object.keys(respuestasForm).map(key => ({
      campoId: key,
      valor: respuestasForm[key]
    }));

    // 1. Emitir Anexo 27
    emitirAnexo(
      {
        anexoTemplateId: 'anexo-27',
        documentoId: documento.id,
        seccionId: activeSeccion.id,
        versionArchivoId: versionId,
        emitidoPorId: currentUser.id,
        emitidoPorNombre: currentUser.name,
        valores: valoresA27,
        comentariosAnotados: []
      },
      'coincide',
      'revision-tecnica',
      'Estratificación de riesgo completada: Confirmado sin riesgo.',
      'sin-riesgo'
    );

    // 2. Emitir Anexo 11 (Exención Ética)
    emitirAnexo(
      {
        anexoTemplateId: 'anexo-11',
        documentoId: documento.id,
        seccionId: activeSeccion.id,
        versionArchivoId: versionId,
        emitidoPorId: currentUser.id,
        emitidoPorNombre: currentUser.name,
        valores: [
          { campoId: 'a11_c1', valor: `Exención ética autorizada tras análisis de estratificación. Criterio: ${justificacionText}` },
          { campoId: 'a11_c2', valor: true }
        ],
        comentariosAnotados: []
      },
      'aprobado',
      'revision-tecnica',
      'Carta de exención emitida. El proyecto pasa a revisión técnica (Etapa 2).',
      'sin-riesgo'
    );

    window.alert('Se ha confirmado la exención de revisión ética (Anexo 11). Trámite pasa a Revisión Técnica.');
    navigate('/evaluador');
  };

  // ACCIÓN 2: Elevar Riesgo (Fuera de Alcance del Prototipo)
  const handleElevarRiesgo = () => {
    const justificacionText = respuestasForm[Object.keys(respuestasForm).slice(-1)[0]] || '';
    if (!justificacionText.trim()) {
      return alert('Debe detallar la justificación técnica de la reclasificación.');
    }

    const versionId = latestVersion?.id || '';
    const valoresA27: ValorCampo[] = Object.keys(respuestasForm).map(key => ({
      campoId: key,
      valor: respuestasForm[key]
    }));

    // Emitir Anexo 27 con Discrepa
    emitirAnexo(
      {
        anexoTemplateId: 'anexo-27',
        documentoId: documento.id,
        seccionId: activeSeccion.id,
        versionArchivoId: versionId,
        emitidoPorId: currentUser.id,
        emitidoPorNombre: currentUser.name,
        valores: valoresA27,
        comentariosAnotados: []
      },
      'discrepa',
      'revision-tecnica',
      `Estratificación modificada a: ${nuevoRiesgoEleccion.replace('-', ' ')}. Justificación: ${justificacionText}`,
      nuevoRiesgoEleccion
    );

    window.alert(`El riesgo del proyecto ha sido reclasificado a ${nuevoRiesgoEleccion.replace('-', ' ')}. El trámite queda congelado fuera de alcance.`);
    navigate('/evaluador');
  };

  // ACCIÓN 3: Inhibición por Conflicto (Anexo 23)
  const handleDeclararConflicto = () => {
    if (!conflictoComentario.trim()) {
      return alert('Describa detalladamente la causa de su conflicto de interés.');
    }

    darseDeBajaRevisor(documento.id, currentUser.id, currentUser.name, conflictoComentario.trim());
    window.alert('Se ha registrado su conflicto de interés (Anexo 23). La plataforma lo ha retirado de este proyecto y asignado otro revisor.');
    navigate('/evaluador');
  };

  // ACCIÓN 4: Devolver para Observaciones (Etapa 2)
  const handleDevolverInvestigador = () => {
    if (!devolucionComentario.trim()) {
      return alert('Debe ingresar un comentario indicando las observaciones.');
    }

    const versionId = latestVersion?.id || '';

    // Emitir Anexo 27 con observaciones
    emitirAnexo(
      {
        anexoTemplateId: activeAnexoId || 'anexo-27',
        documentoId: documento.id,
        seccionId: activeSeccion.id,
        versionArchivoId: versionId,
        emitidoPorId: currentUser.id,
        emitidoPorNombre: currentUser.name,
        valores: Object.keys(respuestasForm).map(key => ({ campoId: key, valor: respuestasForm[key] })),
        comentariosAnotados: []
      },
      'con-observaciones',
      'creada',
      `Proyecto devuelto al Investigador para correcciones. Motivo: ${devolucionComentario}`
    );

    window.alert('Proyecto devuelto al investigador en estado Borrador.');
    navigate('/evaluador');
  };

  // ACCIÓN 5: Escalar al Administrador
  const handleEscalarAdmin = () => {
    if (!escalamientoComentario.trim()) {
      return alert('Escriba la causa del escalamiento.');
    }

    // Guardar borrador del anexo primero
    handleGuardarBorrador();

    // Encontrar borrador guardado para ligarlo
    const versionId = latestVersion?.id || '';
    const resp = respuestasAnexos.find(
      r => r.documentoId === documento.id && r.anexoTemplateId === activeAnexoId && r.versionArchivoId === versionId
    );

    crearEscalamiento(
      documento.id,
      activeSeccion.id,
      activeAnexoId || '',
      escalamientoComentario.trim(),
      resp?.id || ''
    );

    window.alert('Escalamiento registrado. El administrador revisará y editará el anexo. El proceso sigue corriendo en paralelo.');
    setShowEscalarModal(false);
    setEscalamientoComentario('');
  };

  // ============================================================================
  // DISPARADORES DE ACCIÓN (Mapeados por Anexo ID en Evaluación Técnica)
  // ============================================================================

  // ACCIÓN A: Aprobar Proyecto (Emisión de Anexo 12 y Anexo 13)
  const handleAprobarProyecto = () => {
    const versionId = latestVersion?.id || '';
    const valoresA12 = Object.keys(respuestasForm).map(key => ({
      campoId: key,
      valor: respuestasForm[key]
    }));

    // 1. Emitir Anexo 12
    emitirAnexo(
      {
        anexoTemplateId: 'anexo-12',
        documentoId: documento.id,
        seccionId: activeSeccion.id,
        versionArchivoId: versionId,
        emitidoPorId: currentUser.id,
        emitidoPorNombre: currentUser.name,
        valores: valoresA12,
        comentariosAnotados: []
      },
      'aprobado',
      'aprobada',
      'Evaluación técnica aprobada.'
    );

    // 2. Emitir Anexo 13 (Resolución de Aprobación Final)
    emitirAnexo(
      {
        anexoTemplateId: 'anexo-13',
        documentoId: documento.id,
        seccionId: activeSeccion.id,
        versionArchivoId: versionId,
        emitidoPorId: currentUser.id,
        emitidoPorNombre: currentUser.name,
        valores: [
          { campoId: 'a13_c1', valor: true },
          { campoId: 'a13_c2', valor: 'Aprobación definitiva ética y metodológica emitida sin observaciones.' }
        ],
        comentariosAnotados: []
      },
      'aprobado',
      'aprobada',
      'Emisión oficial de la Resolución de Aprobación del CEISH.'
    );

    window.alert('Proyecto aprobado ética y metodológicamente (Anexo 13). Trámite finalizado con éxito.');
    navigate('/evaluador');
  };

  // ACCIÓN B: No Aprobar (Devolver con observaciones, mantiene revisión técnica)
  const handleNoAprobarDevolver = () => {
    if (anotaciones.length === 0) return;

    const versionId = latestVersion?.id || '';
    const valoresA12 = Object.keys(respuestasForm).map(key => ({
      campoId: key,
      valor: respuestasForm[key]
    }));

    // Emitir Anexo 12 con observaciones, mantiene estado 'revision-tecnica'
    emitirAnexo(
      {
        anexoTemplateId: 'anexo-12',
        documentoId: documento.id,
        seccionId: activeSeccion.id,
        versionArchivoId: versionId,
        emitidoPorId: currentUser.id,
        emitidoPorNombre: currentUser.name,
        valores: valoresA12,
        comentariosAnotados: anotaciones // Guardamos la colección de observaciones detallando página
      },
      'con-observaciones',
      'revision-tecnica', // Mantiene el estado en revisión técnica
      'No aprobado en esta ronda. Proyecto devuelto al investigador con observaciones metodológicas.'
    );

    window.alert('Proyecto devuelto con observaciones técnicas. Se mantiene en revisión técnica y el investigador ya puede cargar su corrección.');
    navigate('/evaluador');
  };

  // ACCIÓN C: Dar de Baja Proyecto (Anexo 26)
  const handleDarDeBaja = () => {
    const motivo = prompt('Por favor, ingrese la causa técnica de la baja definitiva / revocatoria del protocolo:');
    if (!motivo) return;

    const versionId = latestVersion?.id || '';

    emitirAnexo(
      {
        anexoTemplateId: 'anexo-26',
        documentoId: documento.id,
        seccionId: activeSeccion.id,
        versionArchivoId: versionId,
        emitidoPorId: currentUser.id,
        emitidoPorNombre: currentUser.name,
        valores: [
          { campoId: 'a26_c1', valor: motivo },
          { campoId: 'a26_c2', valor: true }
        ],
        comentariosAnotados: []
      },
      'baja',
      'anulada',
      `Proyecto dado de baja definitiva del CEISH. Causa: ${motivo}`
    );

    window.alert('Expediente anulado / suspendido definitivamente (Anexo 26).');
    navigate('/evaluador');
  };

  // Obtener emisiones previas de evaluación metodológica (Anexo 12) para contrastar
  const getHistorialRondasA12 = () => {
    return respuestasAnexos.filter(
      r => r.documentoId === documento.id && r.anexoTemplateId === 'anexo-12' && r.resultado === 'con-observaciones'
    );
  };
  const rondasPreviasA12 = getHistorialRondasA12();

  return (
    <div className="eval-layout">
      <div className="eval-body">
        {/* 1. Visor de PDF (Panel Izquierdo) */}
        <main className="eval-pdf-panel">
        <div className="eval-left-header">
          <span>Expediente: <strong>{documento.codigo}</strong></span>
          <span>Pág. {pdf.currentPage} de {pdf.totalPages || '?'}</span>
        </div>

        <div className="eval-pdf-container">
          {fileObj ? (
            <PDFViewer
              file={fileObj}
              currentPage={pdf.currentPage}
              totalPages={pdf.totalPages}
              zoom={pdf.zoom}
              isLoading={pdf.isLoading}
              onLoadSuccess={pdf.setTotalPages}
              onLoadFile={pdf.loadFile}
              onPrevPage={pdf.prevPage}
              onNextPage={pdf.nextPage}
              onZoomIn={pdf.zoomIn}
              onZoomOut={pdf.zoomOut}
              onResetZoom={pdf.resetZoom}
              onPageChange={pdf.goToPage}
            />
          ) : (
            <div className="pdf-placeholder-alert">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <h4>Documento no disponible tras recarga</h4>
              <p>En este prototipo, el archivo PDF subido en memoria se limpia del caché al refrescar el navegador.</p>
              <p className="highlight">Por favor, vaya al dashboard del Investigador y vuelva a subir el archivo para esta prueba.</p>
            </div>
          )}
        </div>
        </main>

        {/* 2. Panel de Evaluación (Panel Derecho) */}
        <aside className="criteria-panel" style={{ borderLeft: '2px solid #cbd5e1', boxShadow: '-2px 0 10px rgba(0,0,0,0.05)' }}>
        <div className="eval-tabs">
          <button 
            className={`eval-tabs__btn ${activeTab === 'evaluacion-dinamica' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluacion-dinamica')}
          >
            Formulario ({activeSeccion.nombre})
          </button>
          <button 
            className={`eval-tabs__btn ${activeTab === 'investigador-llenado' ? 'active' : ''}`}
            onClick={() => setActiveTab('investigador-llenado')}
          >
            Llenado Investigador (Etapa 1)
          </button>
          <button 
            className={`eval-tabs__btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Ficha Técnica
          </button>
        </div>

        <div className="eval-right-body" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeTab === 'info' ? (
            <div className="eval-info-view" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#64748b', textTransform: 'uppercase' }}>Tema / Proyecto</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{documento.tema}</p>
              </div>

              <div>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#64748b', textTransform: 'uppercase' }}>Resumen</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>{documento.descripcion}</p>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: 0, fontSize: '12px', color: '#0369a1', fontWeight: 700 }}>Modo de Revisión Ciega</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#0e7490', lineHeight: '1.4' }}>
                  Las identidades de los autores y co-autores del protocolo están enmascaradas para garantizar imparcialidad científica y metodológica.
                </p>
              </div>
            </div>
          ) : activeTab === 'investigador-llenado' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '6px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#1e3a8a', fontWeight: 700 }}>Respuestas de Inicio del Investigador</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#1e40af' }}>
                  A continuación se presentan los campos y anexos obligatorios que completó el investigador durante la creación de este trámite.
                </p>
              </div>

              {(() => {
                const firstSection = tipoDoc.secciones[0];
                const respuestasInvestigador = respuestasAnexos.filter(
                  r => r.documentoId === documento.id && r.seccionId === (firstSection?.id || 'sec-creacion')
                );

                if (respuestasInvestigador.length === 0) {
                  return (
                    <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                      No se encontraron respuestas registradas para la Etapa 1 de este proyecto.
                    </p>
                  );
                }

                return respuestasInvestigador.map(resp => {
                  const template = anexosTemplates.find(t => t.id === resp.anexoTemplateId);
                  if (!template) return null;

                  return (
                    <div key={resp.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                      <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                        Anexo {template.numero}: {template.nombre}
                      </h5>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {resp.valores.map(val => {
                          const pregunta = resp.snapshotPreguntas.find(p => p.id === val.campoId);
                          if (!pregunta) return null;

                          return (
                            <div key={val.campoId} style={{ fontSize: '12px' }}>
                              <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>{pregunta.texto}</p>
                              <p style={{ margin: '2px 0 0 0', color: '#0f172a', background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', borderLeft: '3px solid #cbd5e1', whiteSpace: 'pre-wrap' }}>
                                {typeof val.valor === 'boolean' 
                                  ? (val.valor ? 'Sí' : 'No') 
                                  : (val.valor ? String(val.valor) : <em style={{ color: '#94a3b8' }}>Sin respuesta</em>)
                                }
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="eval-dynamic-flow" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Selector de Anexo según Configuración */}
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
                {activeSeccion.anexos.map(an => {
                  const temp = anexosTemplates.find(t => t.id === an.anexoTemplateId);
                  if (!temp) return null;

                  return (
                    <button
                      key={temp.id}
                      className={`eval-tabs__btn ${activeAnexoId === temp.id ? 'active' : ''}`}
                      onClick={() => setActiveAnexoId(temp.id)}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      Anexo {temp.numero} {an.obligatorio ? '*' : ''}
                    </button>
                  );
                })}
              </div>

              {/* Formulario de Preguntas Dinámicas */}
              {activeAnexoId && (() => {
                const template = anexosTemplates.find(t => t.id === activeAnexoId);
                if (!template) return null;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                        Anexo {template.numero}: {template.nombre}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {template.preguntas.map((p) => (
                        <div key={p.id} className="form-group" style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                          {p.descripcionContexto && (
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px', display: 'block' }}>
                              [{p.descripcionContexto}]
                            </span>
                          )}
                          <label className="form-label" style={{ fontSize: '12.5px', lineHeight: '1.4' }}>{p.texto}</label>

                          {p.tipo === 'texto-libre' ? (
                            <textarea
                              className="form-input"
                              rows={3}
                              value={respuestasForm[p.id] || ''}
                              onChange={(e) => handlePreguntaChange(p.id, e.target.value)}
                              placeholder="Escriba su criterio u observaciones..."
                              style={{ fontSize: '12px', marginTop: '6px' }}
                            />
                          ) : p.tipo === 'si-no' || p.tipo === 'cumple-nocumple' ? (
                            <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px' }}>
                                <input
                                  type="radio"
                                  name={`preg-${p.id}`}
                                  checked={respuestasForm[p.id] === true}
                                  onChange={() => handlePreguntaChange(p.id, true)}
                                />
                                <span>Sí / Cumple</span>
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px' }}>
                                <input
                                  type="radio"
                                  name={`preg-${p.id}`}
                                  checked={respuestasForm[p.id] === false}
                                  onChange={() => handlePreguntaChange(p.id, false)}
                                />
                                <span>No / No Cumple</span>
                              </label>
                            </div>
                          ) : (
                            <label className="checkbox-label" style={{ marginTop: '6px' }}>
                              <input
                                  type="checkbox"
                                  checked={!!respuestasForm[p.id]}
                                  onChange={(e) => handlePreguntaChange(p.id, e.target.checked)}
                              />
                              <span>Declaratoria de conformidad</span>
                            </label>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* FASE 3: OBSERVACIONES ESPECÍFICAS POR PÁGINA (Solo para Evaluación Anexo 12) */}
                    {activeAnexoId === 'anexo-12' && (
                      <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                          Observaciones al PDF por Página
                        </h4>
                        
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <textarea
                            className="form-input"
                            placeholder="Describa la observación en el documento..."
                            rows={2}
                            value={nuevoComentarioTexto}
                            onChange={(e) => setNuevoComentarioTexto(e.target.value)}
                            style={{ flex: 1, fontSize: '12px' }}
                          />
                          <button
                            type="button"
                            className="eval-btn eval-btn--outline"
                            onClick={handleAgregarAnotacion}
                            style={{ fontSize: '11px', padding: '6px 10px', alignSelf: 'flex-end', whiteSpace: 'wrap', maxWidth: '100px' }}
                          >
                            Agregar en Pág. {pdf.currentPage}
                          </button>
                        </div>

                        {/* Listado de Anotaciones en la Ronda */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                          {anotaciones.length === 0 ? (
                            <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontStyle: 'italic' }}>
                              Ninguna anotación específica registrada.
                            </p>
                          ) : (
                            anotaciones.map((anot) => (
                              <div key={anot.id} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px' }}>
                                <span style={{ flex: 1, color: '#334155' }}>
                                  <strong>Pág. {anot.paginaPdf}:</strong> "{anot.texto}"
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleEliminarAnotacion(anot.id)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', fontSize: '13px' }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* BOTÓN GENERAL DE GUARDAR BORRADOR EN ANEXO */}
                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #cbd5e1', paddingTop: '12px' }}>
                      <button type="button" className="eval-btn eval-btn--outline" onClick={handleGuardarBorrador} style={{ fontSize: '12px' }}>
                        Guardar Borrador
                      </button>
                      <button type="button" className="eval-btn eval-btn--outline eval-btn--danger" onClick={() => setShowEscalarModal(true)} style={{ fontSize: '12px', marginLeft: 'auto' }}>
                        Escalar a Admin
                      </button>
                    </div>

                    {/* HISTORIAL DE RONDAS DE EVALUACIÓN ANTERIORES (Para Anexo 12) */}
                    {activeAnexoId === 'anexo-12' && rondasPreviasA12.length > 0 && (
                      <div style={{ borderTop: '1.5px solid #cbd5e1', paddingTop: '16px', marginTop: '10px' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                          Historial de Evaluaciones de Rondas Anteriores
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {rondasPreviasA12.map((ron, rIdx) => (
                            <div key={ron.id} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '8px' }}>
                              <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                                Ronda #{rIdx + 1} (Archivo Evaluado: {documento.versionesArchivo.find(v => v.id === ron.versionArchivoId)?.documentName || 'Desconocido'})
                              </p>
                              <p style={{ margin: '2px 0 6px 0', fontSize: '10px', color: '#64748b' }}>
                                Evaluado el: {new Date(ron.emitidoAt).toLocaleString()} por {ron.emitidoPorNombre}
                              </p>
                              <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '11px', color: '#475569' }}>
                                {ron.comentariosAnotados.map(c => (
                                  <li key={c.id}>
                                    <strong>Pág. {c.paginaPdf}:</strong> "{c.texto}"
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ====================================================================
                        ACCIONES FINALES SEGÚN LA ETAPA ACTIVA
                        ==================================================================== */}
                    
                    {/* ACCIONES DE ESTRATIFICACIÓN (Etapa 2) */}
                    {documento.estado === 'estratificacion' && activeAnexoId === 'anexo-27' && (
                      <div style={{ borderTop: '1.5px solid #cbd5e1', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#eff6ff', padding: '14px', borderRadius: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e3a8a' }}>Resolución de Estratificación (Etapa 1 CEISH)</h4>
                        
                        {/* Opción 1: Confirmar Sin Riesgo */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button type="button" className="eval-btn eval-btn--primary" onClick={handleConfirmarExencion} style={{ width: '100%' }}>
                            Confirmar Exención Ética (Anexo 11)
                          </button>
                          <span style={{ fontSize: '10.5px', color: '#1e40af' }}>✓ Confirma que el proyecto carece de riesgos éticos y lo transiciona a la Etapa 2 de revisión metodológica.</span>
                        </div>

                        {/* Opción 2: Reclasificar Riesgo (Desviación) */}
                        <div style={{ borderTop: '1px solid #bfdbfe', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyItems: 'center', gap: '8px' }}>
                            <select 
                              className="form-input" 
                              value={nuevoRiesgoEleccion} 
                              onChange={(e) => setNuevoRiesgoEleccion(e.target.value as RiesgoTipo)}
                              style={{ fontSize: '12px', flex: 1, padding: '4px' }}
                            >
                              <option value="riesgo-minimo">Riesgo Mínimo</option>
                              <option value="riesgo-mayor">Riesgo Mayor</option>
                            </select>
                            <button type="button" className="eval-btn eval-btn--outline" onClick={handleElevarRiesgo} style={{ fontSize: '11px' }}>
                              Elevar Riesgo
                            </button>
                          </div>
                          <span style={{ fontSize: '10.5px', color: '#6b7280' }}>⚠️ Cambia la estratificación; al ser riesgo mínimo/mayor, el trámite quedará fuera de alcance para este prototipo.</span>
                        </div>

                        {/* Opción 3: Devolución y Conflicto */}
                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #bfdbfe', paddingTop: '10px' }}>
                          <button type="button" className="eval-btn eval-btn--sm eval-btn--outline" onClick={() => setShowDevolverModal(true)} style={{ flex: 1 }}>
                            Devolver para Correcciones
                          </button>
                          <button type="button" className="eval-btn eval-btn--sm eval-btn--danger" onClick={() => setShowConflictoModal(true)} style={{ flex: 1 }}>
                            Declarar Conflicto (Anexo 23)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ACCIONES DE EVALUACIÓN TÉCNICA (Etapa 3) */}
                    {documento.estado === 'revision-tecnica' && activeAnexoId === 'anexo-12' && (
                      <div style={{ borderTop: '1.5px solid #cbd5e1', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#334155' }}>Dictamen de Revisión Metodológica</h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* Botón A: Aprobar Proyecto */}
                          <button type="button" className="eval-btn eval-btn--primary" onClick={handleAprobarProyecto} style={{ width: '100%', background: '#16a34a' }}>
                            Aprobar Proyecto (Anexo 13)
                          </button>

                          {/* Botón B: No Aprobar (Devolver con observaciones) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <button 
                              type="button" 
                              className="eval-btn eval-btn--outline" 
                              onClick={handleNoAprobarDevolver} 
                              disabled={anotaciones.length === 0}
                              style={{ width: '100%', borderColor: '#d97706', color: '#d97706' }}
                            >
                              No Aprobar (Devolver con Observaciones)
                            </button>
                            {anotaciones.length === 0 && (
                              <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 600, textAlign: 'center' }}>
                                (Requiere agregar al menos una observación por página en el panel superior)
                              </span>
                            )}
                          </div>

                          {/* Botón C: Dar de Baja */}
                          <button type="button" className="eval-btn eval-btn--danger" onClick={handleDarDeBaja} style={{ width: '100%' }}>
                            Dar de Baja la Investigación (Anexo 26)
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}

            </div>
          )}
        </div>
        </aside>
      </div>

      {/* 3. MODALES ADICIONALES DE CONTROL DE FLUJO */}

      {/* Modal Declarar Conflicto (Anexo 23) */}
      {showConflictoModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowConflictoModal(false); }}>
          <div className="modal" style={{ maxWidth: '450px' }}>
            <div className="modal__header">
              <h3 className="modal__title">Declaración de Conflicto de Intereses</h3>
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                Describa detalladamente el motivo de su conflicto de interés con el proyecto o sus autores (Anexo 23). Su asignación se cancelará ciegamente.
              </p>
              <textarea
                className="form-input"
                rows={3}
                value={conflictoComentario}
                onChange={(e) => setConflictoComentario(e.target.value)}
                placeholder="Escriba la causa de inhibición aquí..."
                required
              />
            </div>
            <div className="modal__footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="eval-btn eval-btn--outline" onClick={() => setShowConflictoModal(false)}>Cancelar</button>
              <button className="eval-btn eval-btn--danger" onClick={handleDeclararConflicto} disabled={!conflictoComentario.trim()}>
                Confirmar Inhibición (A23)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Devolver para Observaciones */}
      {showDevolverModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowDevolverModal(false); }}>
          <div className="modal" style={{ maxWidth: '450px' }}>
            <div className="modal__header">
              <h3 className="modal__title">Devolver Proyecto para Correcciones</h3>
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                Indique los motivos detallados por los cuales se devuelve el proyecto al investigador en estado Borrador.
              </p>
              <textarea
                className="form-input"
                rows={3}
                value={devolucionComentario}
                onChange={(e) => setDevolucionComentario(e.target.value)}
                placeholder="Escriba los comentarios u observaciones aquí..."
                required
              />
            </div>
            <div className="modal__footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="eval-btn eval-btn--outline" onClick={() => setShowDevolverModal(false)}>Cancelar</button>
              <button className="eval-btn eval-btn--primary" onClick={handleDevolverInvestigador} disabled={!devolucionComentario.trim()}>
                Enviar observaciones
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Escalar a Administrador */}
      {showEscalarModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowEscalarModal(false); }}>
          <div className="modal" style={{ maxWidth: '450px' }}>
            <div className="modal__header">
              <h3 className="modal__title">Escalar Anexo a Administrador</h3>
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                Escriba el comentario o duda sobre este anexo. El administrador podrá editar directamente el anexo para resolver el caso oficial.
              </p>
              <textarea
                className="form-input"
                rows={3}
                value={escalamientoComentario}
                onChange={(e) => setEscalamientoComentario(e.target.value)}
                placeholder="Describa el motivo de la consulta..."
                required
              />
            </div>
            <div className="modal__footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="eval-btn eval-btn--outline" onClick={() => setShowEscalarModal(false)}>Cancelar</button>
              <button className="eval-btn eval-btn--primary" onClick={handleEscalarAdmin} disabled={!escalamientoComentario.trim()}>
                Escalar caso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
