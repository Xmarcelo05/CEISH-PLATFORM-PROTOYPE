import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useCeishStore } from '../../../store/ceishStore';
import { ceishFileCache } from '../../../store/fileCache';
import { usePDFViewer } from '../../evaluation/hooks/usePDFViewer';
import { PDFViewer } from '../../evaluation/components/PDFViewer/PDFViewer';
import type { RiesgoTipo } from '../../../shared/types/platform.types';
import '../../evaluation/evaluation.css';
import '../evaluator.css';

type Tab = 'info' | 'estratificacion' | 'revision-tecnica';

export function ReviewCeishPage() {
  const { investigacionId = '' } = useParams<{ investigacionId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser)!;

  const { investigaciones, emitirAnexo, darseDeBajaRevisor } = useCeishStore();

  const investigacion = investigaciones.find((i) => i.id === investigacionId);


  const [activeTab, setActiveTab] = useState<Tab>('info');

  // Estado del Formulario Anexo 27 (Estratificación)
  const [a27_respuestas, setA27Respuestas] = useState<Record<string, boolean>>({
    a27_c1: false,
    a27_c2: false,
    a27_c3: false,
    a27_c4: false
  });
  const [a27_justificacion, setA27Justificacion] = useState('');
  const [nuevoRiesgoEleccion, setNuevoRiesgoEleccion] = useState<RiesgoTipo>('riesgo-minimo');
  const [devolucionComentario, setDevolucionComentario] = useState('');
  const [conflictoComentario, setConflictoComentario] = useState('');

  // Estado del Formulario Anexo 12 (Revisión Técnica)
  const [a12_respuestas, setA12Respuestas] = useState<Record<string, boolean>>({
    a12_c1: true,
    a12_c2: true,
    a12_c3: true,
    a12_c4: true,
    a12_c5: true
  });
  const [a12_observaciones, setA12Observaciones] = useState('');

  // Modales de Acción
  const [showConflictoModal, setShowConflictoModal] = useState(false);
  const [showDevolverModal, setShowDevolverModal] = useState(false);

  // Cargar PDF en el visor si está en memoria
  const pdf = usePDFViewer();
  const { loadFile } = pdf;
  const latestVersion = investigacion?.versionesArchivo.slice(-1)[0];
  const fileObj = latestVersion ? ceishFileCache[latestVersion.documentPath] : null;

  useEffect(() => {
    if (fileObj) {
      loadFile(fileObj);
    }
  }, [fileObj, loadFile]);

  // Si no se encuentra el proyecto o la asignación no es correcta
  if (!investigacion) {
    return (
      <div className="eval-loading">
        <h2>Proyecto no encontrado</h2>
        <button className="eval-btn eval-btn--primary" onClick={() => navigate('/evaluador')}>Volver al Dashboard</button>
      </div>
    );
  }

  // Configurar pestaña por defecto según el estado del proyecto
  useEffect(() => {
    if (investigacion.estado === 'estratificacion') {
      setActiveTab('estratificacion');
    } else if (investigacion.estado === 'revision-tecnica') {
      setActiveTab('revision-tecnica');
    }
  }, [investigacion.estado]);

  const handleCheckboxA27 = (campoId: string) => {
    setA27Respuestas((prev) => ({ ...prev, [campoId]: !prev[campoId] }));
  };

  const handleCheckboxA12 = (campoId: string) => {
    setA12Respuestas((prev) => ({ ...prev, [campoId]: !prev[campoId] }));
  };

  // ACCIÓN 1: Confirmar Sin Riesgo (Anexo 27 coincidente + Emisión Anexo 11)
  const handleConfirmarSinRiesgo = () => {
    if (!a27_justificacion.trim()) {
      window.alert('Debe rellenar la justificación/criterio final del anexo de estratificación.');
      return;
    }

    const versionId = latestVersion?.id || '';

    // 1. Emitir Anexo 27 (Estratificación)
    const emisionA27 = {
      anexoId: 'anexo-27',
      investigacionId: investigacion.id,
      etapa: 'estratificacion' as const,
      versionArchivoId: versionId,
      emitidoPorId: currentUser.id,
      emitidoPorNombre: currentUser.name,
      valores: [
        { campoId: 'a27_c1', valor: a27_respuestas.a27_c1 },
        { campoId: 'a27_c2', valor: a27_respuestas.a27_c2 },
        { campoId: 'a27_c3', valor: a27_respuestas.a27_c3 },
        { campoId: 'a27_c4', valor: a27_respuestas.a27_c4 },
        { campoId: 'a27_c5', valor: a27_justificacion }
      ],
      comentariosAnotados: []
    };
    emitirAnexo(emisionA27, 'coincide', 'revision-tecnica', 'Estratificación completada: Coincide sin riesgo.');

    // 2. Emitir Anexo 11 (Exención Ética)
    const emisionA11 = {
      anexoId: 'anexo-11',
      investigacionId: investigacion.id,
      etapa: 'estratificacion' as const,
      versionArchivoId: versionId,
      emitidoPorId: currentUser.id,
      emitidoPorNombre: currentUser.name,
      valores: [
        { campoId: 'a11_c1', valor: `Exención ética autorizada tras análisis de estratificación. Criterio: ${a27_justificacion}` },
        { campoId: 'a11_c2', valor: true }
      ],
      comentariosAnotados: []
    };
    emitirAnexo(
      emisionA11,
      'aprobado',
      'revision-tecnica',
      'Emisión oficial de Carta de Exención (Anexo 11). Proyecto movido a Revisión Técnica.',
      'sin-riesgo'
    );

    window.alert('Se ha confirmado la exención de revisión ética (Anexo 11). El trámite pasa a Revisión Técnica (Etapa 2).');
    navigate('/evaluador');
  };

  // ACCIÓN 2: Ajustar Clasificación (Desviación del riesgo)
  const handleAjustarRiesgo = () => {
    if (!a27_justificacion.trim()) {
      window.alert('Debe detallar la justificación técnica de la reclasificación.');
      return;
    }

    const versionId = latestVersion?.id || '';

    // Emitir Anexo 27 (Desvia)
    const emisionA27 = {
      anexoId: 'anexo-27',
      investigacionId: investigacion.id,
      etapa: 'estratificacion' as const,
      versionArchivoId: versionId,
      emitidoPorId: currentUser.id,
      emitidoPorNombre: currentUser.name,
      valores: [
        { campoId: 'a27_c1', valor: a27_respuestas.a27_c1 },
        { campoId: 'a27_c2', valor: a27_respuestas.a27_c2 },
        { campoId: 'a27_c3', valor: a27_respuestas.a27_c3 },
        { campoId: 'a27_c4', valor: a27_respuestas.a27_c4 },
        { campoId: 'a27_c5', valor: `RECLASIFICADO A ${nuevoRiesgoEleccion.toUpperCase()}. Motivo: ${a27_justificacion}` }
      ],
      comentariosAnotados: []
    };

    // Pasamos a revision-tecnica pero asignando el nuevoRiesgoEleccion
    emitirAnexo(
      emisionA27,
      'discrepa',
      'revision-tecnica',
      `Estratificación: El revisor elevó la clasificación a ${nuevoRiesgoEleccion.replace('-', ' ')}. Justificación: ${a27_justificacion}`,
      nuevoRiesgoEleccion
    );

    window.alert(`El proyecto ha sido reclasificado a: ${nuevoRiesgoEleccion.replace('-', ' ')} y movido a Revisión Técnica (Fuera de alcance del prototipo).`);
    navigate('/evaluador');
  };

  // ACCIÓN 3: Devolver para correcciones (Sección 3.8)
  const handleDevolverProyecto = () => {
    if (!devolucionComentario.trim()) {
      window.alert('Debe rellenar los comentarios de corrección para el investigador.');
      return;
    }

    const versionId = latestVersion?.id || '';

    // Emitimos el anexo actual en borrador/rechazo parcial para guardar las anotaciones
    const emisionA27 = {
      anexoId: investigacion.estado === 'estratificacion' ? 'anexo-27' : 'anexo-12',
      investigacionId: investigacion.id,
      etapa: investigacion.estado === 'estratificacion' ? ('estratificacion' as const) : ('revision-tecnica' as const),
      versionArchivoId: versionId,
      emitidoPorId: currentUser.id,
      emitidoPorNombre: currentUser.name,
      valores: investigacion.estado === 'estratificacion' ? [
        { campoId: 'a27_c1', valor: a27_respuestas.a27_c1 },
        { campoId: 'a27_c2', valor: a27_respuestas.a27_c2 },
        { campoId: 'a27_c3', valor: a27_respuestas.a27_c3 },
        { campoId: 'a27_c4', valor: a27_respuestas.a27_c4 },
        { campoId: 'a27_c5', valor: `Devuelto para corrección: ${devolucionComentario}` }
      ] : [
        { campoId: 'a12_c1', valor: a12_respuestas.a12_c1 },
        { campoId: 'a12_c2', valor: a12_respuestas.a12_c2 },
        { campoId: 'a12_c3', valor: a12_respuestas.a12_c3 },
        { campoId: 'a12_c4', valor: a12_respuestas.a12_c4 },
        { campoId: 'a12_c5', valor: a12_respuestas.a12_c5 },
        { campoId: 'a12_obs', valor: `Devuelto para corrección: ${devolucionComentario}` }
      ],
      comentariosAnotados: []
    };

    // Emitimos y transicionamos de vuelta a 'creada' (borrador para el investigador)
    emitirAnexo(
      emisionA27,
      'con-observaciones',
      'creada',
      `Observaciones de revisión: El proyecto fue devuelto para correcciones. Detalles: ${devolucionComentario}`
    );

    window.alert('El proyecto ha sido devuelto al investigador. Se le notificará el listado de observaciones.');
    navigate('/evaluador');
  };

  // ACCIÓN 4: Inhibirse / Conflictos de Interés (Anexo 23)
  const handleInhibirse = () => {
    if (!conflictoComentario.trim()) {
      window.alert('Debe justificar la causa de su conflicto de interés.');
      return;
    }

    darseDeBajaRevisor(investigacion.id, currentUser.id, currentUser.name, conflictoComentario);
    window.alert(
      'Ha declarado conflicto de interés (Anexo 23). Se ha cancelado su asignación y la plataforma reasignará el proyecto a otro revisor.'
    );
    navigate('/evaluador');
  };

  // ACCIÓN 5: Emitir Resolución Aprobación (Anexo 13 - Finalización)
  const handleFinalizarAprobacion = () => {
    if (!a12_observaciones.trim()) {
      window.alert('Debe rellenar las observaciones finales para la aprobación.');
      return;
    }

    const versionId = latestVersion?.id || '';

    // 1. Emitir Anexo 12 (Evaluación)
    const emisionA12 = {
      anexoId: 'anexo-12',
      investigacionId: investigacion.id,
      etapa: 'revision-tecnica' as const,
      versionArchivoId: versionId,
      emitidoPorId: currentUser.id,
      emitidoPorNombre: currentUser.name,
      valores: [
        { campoId: 'a12_c1', valor: a12_respuestas.a12_c1 },
        { campoId: 'a12_c2', valor: a12_respuestas.a12_c2 },
        { campoId: 'a12_c3', valor: a12_respuestas.a12_c3 },
        { campoId: 'a12_c4', valor: a12_respuestas.a12_c4 },
        { campoId: 'a12_c5', valor: a12_respuestas.a12_c5 },
        { campoId: 'a12_obs', valor: a12_observaciones }
      ],
      comentariosAnotados: []
    };
    emitirAnexo(emisionA12, 'coincide', 'revision-tecnica', 'Revisión técnica aprobada en formato check-list.');

    // 2. Emitir Anexo 13 (Resolución de Aprobación Final)
    const emisionA13 = {
      anexoId: 'anexo-13',
      investigacionId: investigacion.id,
      etapa: 'revision-tecnica' as const,
      versionArchivoId: versionId,
      emitidoPorId: currentUser.id,
      emitidoPorNombre: currentUser.name,
      valores: [
        { campoId: 'a13_c1', valor: true },
        { campoId: 'a13_c2', valor: `Proyecto aprobado ética y metodológicamente. Condiciones: ${a12_observaciones}` }
      ],
      comentariosAnotados: []
    };
    emitirAnexo(emisionA13, 'aprobado', 'aprobada', 'Emisión oficial de Resolución de Aprobación Ética (Anexo 13).');

    window.alert('Se ha emitido la Resolución de Aprobación (Anexo 13). El trámite ha sido Aprobado de forma definitiva.');
    navigate('/evaluador');
  };

  // ACCIÓN 6: Anular / Rechazar Proyecto (Anexo 26)
  const handleAnularProyecto = () => {
    if (!a12_observaciones.trim()) {
      window.alert('Debe justificar técnicamente los motivos de la anulación del proyecto.');
      return;
    }

    const versionId = latestVersion?.id || '';

    // Emitir Anexo 26
    const emisionA26 = {
      anexoId: 'anexo-26',
      investigacionId: investigacion.id,
      etapa: 'revision-tecnica' as const,
      versionArchivoId: versionId,
      emitidoPorId: currentUser.id,
      emitidoPorNombre: currentUser.name,
      valores: [
        { campoId: 'a26_c1', valor: a12_observaciones },
        { campoId: 'a26_c2', valor: true }
      ],
      comentariosAnotados: []
    };

    emitirAnexo(emisionA26, 'baja', 'anulada', `El proyecto ha sido anulado / rechazado. Motivo: ${a12_observaciones}`);
    window.alert('Se ha emitido la resolución de anulación (Anexo 26). El proyecto ha sido Anulado.');
    navigate('/evaluador');
  };

  return (
    <div className="eval-layout" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh', overflow: 'hidden' }}>
      
      {/* Encabezado del Evaluador */}
      <header className="eval-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => navigate('/evaluador')} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '50%' }}
            title="Volver al Dashboard"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              Evaluación Ciega: {investigacion.codigo}
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Revisor: {currentUser.name} (Confidencial)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {investigacion.estado === 'estratificacion' && (
            <button 
              className="eval-btn eval-btn--outline" 
              style={{ color: '#ef4444', borderColor: '#fca5a5' }}
              onClick={() => setShowConflictoModal(true)}
            >
              Declarar Conflicto de Interés
            </button>
          )}
          <button 
            className="eval-btn eval-btn--outline" 
            style={{ color: '#e29400', borderColor: '#fcd34d' }}
            onClick={() => setShowDevolverModal(true)}
          >
            Devolver para Correcciones
          </button>
        </div>
      </header>

      {/* Cuerpo Principal del Visor Split Screen */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', overflow: 'hidden' }}>
        
        {/* Panel Izquierdo: Visor de PDF */}
        <div style={{ background: '#f1f5f9', overflow: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {fileObj ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
            </div>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', padding: '30px', maxWidth: '450px', background: 'white', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: '1px solid #e2e8f0' }}>
              <div style={{ margin: '0 auto 16px auto', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', borderRadius: '50%', color: '#ef4444' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>Documento PDF no disponible</h3>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                El archivo del protocolo se encuentra en memoria de sesión y no sobrevivió a la recarga de página.
              </p>
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', fontSize: '11px', color: '#475569', textAlign: 'left', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <strong>Para visualizarlo en esta prueba:</strong> Regrese al rol de Investigador (Juan Pérez), edite o registre el proyecto subiendo el archivo de nuevo.
              </div>
              <button className="eval-btn eval-btn--outline" style={{ width: '100%' }} onClick={() => navigate('/evaluador')}>
                Regresar a Mis Revisiones
              </button>
            </div>
          )}
        </div>

        {/* Panel Derecho: Control de Evaluación */}
        <div style={{ background: 'white', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* Navegación por Pestañas */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <button 
              onClick={() => setActiveTab('info')}
              style={{ flex: 1, padding: '12px 6px', border: 'none', background: activeTab === 'info' ? 'white' : 'transparent', borderBottom: activeTab === 'info' ? '2px solid #2563eb' : 'none', fontWeight: activeTab === 'info' ? 600 : 400, color: activeTab === 'info' ? '#2563eb' : '#64748b', cursor: 'pointer', fontSize: '13px' }}
            >
              Info Proyecto
            </button>
            
            {investigacion.estado === 'estratificacion' && (
              <button 
                onClick={() => setActiveTab('estratificacion')}
                style={{ flex: 1, padding: '12px 6px', border: 'none', background: activeTab === 'estratificacion' ? 'white' : 'transparent', borderBottom: activeTab === 'estratificacion' ? '2px solid #2563eb' : 'none', fontWeight: activeTab === 'estratificacion' ? 600 : 400, color: activeTab === 'estratificacion' ? '#2563eb' : '#64748b', cursor: 'pointer', fontSize: '13px' }}
              >
                Estratificación (A27)
              </button>
            )}

            {investigacion.estado === 'revision-tecnica' && (
              <button 
                onClick={() => setActiveTab('revision-tecnica')}
                style={{ flex: 1, padding: '12px 6px', border: 'none', background: activeTab === 'revision-tecnica' ? 'white' : 'transparent', borderBottom: activeTab === 'revision-tecnica' ? '2px solid #2563eb' : 'none', fontWeight: activeTab === 'revision-tecnica' ? 600 : 400, color: activeTab === 'revision-tecnica' ? '#2563eb' : '#64748b', cursor: 'pointer', fontSize: '13px' }}
              >
                Revisión Técnica (A12)
              </button>
            )}
          </div>

          {/* Contenido de la Pestaña Activa */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Pestaña: Info Proyecto */}
            {activeTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', fontWeight: 600 }}>TEMA / TÍTULO DE INVESTIGACIÓN</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{investigacion.tema}</p>
                </div>

                <div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 600 }}>RESUMEN DEL PROYECTO</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>{investigacion.descripcion}</p>
                </div>

                <div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 600 }}>AUTORES Y CO-INVESTIGADORES</p>
                  <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', color: '#475569', fontSize: '12px', fontStyle: 'italic', marginTop: '4px' }}>
                    🔒 Ocultado por Garantía de Revisión Ciega (Sección 3.2).
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 600 }}>RIESGO DECLARADO</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', fontWeight: 600, color: '#1e293b', textTransform: 'capitalize' }}>
                      {investigacion.riesgoDeclarado.replace('-', ' ')}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ESTADO ACTUAL</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>
                      {investigacion.estado === 'estratificacion' ? 'Estratificación (Etapa 1)' : 'Revisión Técnica (Etapa 2)'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pestaña: Estratificación (Anexo 27) */}
            {activeTab === 'estratificacion' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', padding: '12px', borderRadius: '6px', color: '#9d174d', fontSize: '12px' }}>
                  <strong>Instrucción del Anexo 27:</strong> Marque los criterios de riesgo detectados. Si todos son falsos/negativos, confirme el proyecto como <strong>Sin Riesgo</strong>.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      style={{ marginTop: '3px' }} 
                      checked={a27_respuestas.a27_c1} 
                      onChange={() => handleCheckboxA27('a27_c1')}
                    />
                    <span>¿El estudio causa algún daño físico, psicológico o moral directo en el sujeto evaluado?</span>
                  </label>
                  
                  <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      style={{ marginTop: '3px' }} 
                      checked={a27_respuestas.a27_c2} 
                      onChange={() => handleCheckboxA27('a27_c2')}
                    />
                    <span>¿Involucra captura o almacenamiento de datos personales sensibles o información privada?</span>
                  </label>

                  <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      style={{ marginTop: '3px' }} 
                      checked={a27_respuestas.a27_c3} 
                      onChange={() => handleCheckboxA27('a27_c3')}
                    />
                    <span>¿Se recolectan y analizan muestras biológicas humanas (tejido, sangre, ADN)?</span>
                  </label>

                  <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      style={{ marginTop: '3px' }} 
                      checked={a27_respuestas.a27_c4} 
                      onChange={() => handleCheckboxA27('a27_c4')}
                    />
                    <span>¿El universo de estudio abarca poblaciones vulnerables (niños, embarazadas, reclusos)?</span>
                  </label>
                </div>

                <div className="modal__field">
                  <label className="modal__label">Justificación Técnica / Criterio del Revisor *</label>
                  <textarea 
                    className="modal__textarea"
                    required
                    rows={4}
                    placeholder="Escriba aquí los argumentos que respaldan su decisión sobre el nivel de riesgo..."
                    value={a27_justificacion}
                    onChange={(e) => setA27Justificacion(e.target.value)}
                  />
                </div>

                {/* Acciones de la Estratificación */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '10px' }}>
                  
                  {/* Opción A: Confirmar como Sin Riesgo */}
                  <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#166534', fontWeight: 600 }}>RAMA: SIN RIESGO</p>
                    <button 
                      className="eval-btn eval-btn--primary" 
                      style={{ width: '100%', padding: '8px 12px' }}
                      onClick={handleConfirmarSinRiesgo}
                      disabled={Object.values(a27_respuestas).some(val => val === true)}
                    >
                      Confirmar Exención Ética (Anexo 11)
                    </button>
                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#15803d', textAlign: 'center' }}>
                      (Solo disponible si todos los criterios de riesgo son negativos)
                    </p>
                  </div>

                  {/* Opción B: Desviación (Riesgo Mínimo o Mayor) */}
                  <div style={{ background: '#fffbeb', padding: '12px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#92400e', fontWeight: 600 }}>RAMA: RECLASIFICAR RIESGO (DESVIACIÓN)</p>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <select 
                        value={nuevoRiesgoEleccion} 
                        onChange={(e) => setNuevoRiesgoEleccion(e.target.value as RiesgoTipo)}
                        style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="riesgo-minimo">Riesgo Mínimo</option>
                        <option value="riesgo-mayor">Riesgo Mayor</option>
                      </select>
                      <button 
                        className="eval-btn eval-btn--outline" 
                        style={{ padding: '6px 12px', background: 'white' }}
                        onClick={handleAjustarRiesgo}
                      >
                        Reclasificar
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: '10px', color: '#b45309' }}>
                      Nota: Elevar el riesgo moverá el trámite a la Etapa 2 de forma declarativa (Fuera del alcance interactivo).
                    </p>
                  </div>

                </div>
              </div>
            )}

            {/* Pestaña: Revisión Técnica (Anexo 12) */}
            {activeTab === 'revision-tecnica' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Si fue reclasificado a riesgo mínimo/mayor */}
                {(investigacion.riesgoConfirmado === 'riesgo-minimo' || investigacion.riesgoConfirmado === 'riesgo-mayor') ? (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '16px', borderRadius: '8px', color: '#991b1b', textAlign: 'center' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 10px auto' }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <h3 style={{ fontSize: '14px', margin: '0 0 6px 0', fontWeight: 700 }}>Riesgo Mínimo/Mayor Confirmado</h3>
                    <p style={{ fontSize: '12px', margin: 0, lineHeight: '1.4' }}>
                      Este proyecto fue reclasificado con riesgo ético durante la estratificación. El flujo de evaluación por pares múltiples (2 evaluadores, consolidación por Anexo 12) se encuentra fuera del alcance del presente prototipo.
                    </p>
                    <button 
                      className="eval-btn eval-btn--outline" 
                      style={{ marginTop: '12px', width: '100%', borderColor: '#fca5a5', background: 'white', color: '#b91c1c' }}
                      onClick={() => navigate('/evaluador')}
                    >
                      Volver a Mis Revisiones
                    </button>
                  </div>
                ) : (
                  // Rama Sin Riesgo (Fase Técnica)
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '6px', color: '#166534', fontSize: '12px' }}>
                      <strong>Etapa 2: Revisión Técnica Metodológica (Anexo 12).</strong> Verifique el cumplimiento de los componentes básicos del protocolo para emitir la resolución.
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={a12_respuestas.a12_c1} 
                          onChange={() => handleCheckboxA12('a12_c1')}
                        />
                        <span>Título descriptivo, claro y delimitado temporal/espacialmente.</span>
                      </label>
                      
                      <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={a12_respuestas.a12_c2} 
                          onChange={() => handleCheckboxA12('a12_c2')}
                        />
                        <span>Justificación teórica y empírica del problema planteado.</span>
                      </label>

                      <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={a12_respuestas.a12_c3} 
                          onChange={() => handleCheckboxA12('a12_c3')}
                        />
                        <span>Objetivos coherentes, viables y medibles metodológicamente.</span>
                      </label>

                      <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={a12_respuestas.a12_c4} 
                          onChange={() => handleCheckboxA12('a12_c4')}
                        />
                        <span>Diseño metodológico, instrumentos y técnicas descritas al detalle.</span>
                      </label>

                      <label style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={a12_respuestas.a12_c5} 
                          onChange={() => handleCheckboxA12('a12_c5')}
                        />
                        <span>Fundamentación adecuada de las consideraciones éticas aplicables.</span>
                      </label>
                    </div>

                    <div className="modal__field">
                      <label className="modal__label">Observaciones y Comentarios Finales *</label>
                      <textarea 
                        className="modal__textarea"
                        required
                        rows={4}
                        placeholder="Escriba aquí los términos y condiciones de la resolución o las observaciones metodológicas..."
                        value={a12_observaciones}
                        onChange={(e) => setA12Observaciones(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                      <button 
                        className="eval-btn eval-btn--outline" 
                        style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                        onClick={handleAnularProyecto}
                      >
                        Rechazar / Anular (A26)
                      </button>
                      <button 
                        className="eval-btn eval-btn--primary" 
                        onClick={handleFinalizarAprobacion}
                        disabled={Object.values(a12_respuestas).some(val => val === false)}
                      >
                        Aprobar Proyecto (A13)
                      </button>
                    </div>
                    {Object.values(a12_respuestas).some(val => val === false) && (
                      <p style={{ margin: 0, fontSize: '11px', color: '#92400e', textAlign: 'center' }}>
                        (La aprobación requiere que todos los checklist de evaluación técnica sean verdaderos)
                      </p>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>

        </div>

      </div>

      {/* Modal Declaración de Conflictos de Interés (Anexo 23) */}
      {showConflictoModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowConflictoModal(false); }}>
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title" style={{ color: '#ef4444' }}>Declaración de Conflicto de Interés</h2>
              <button className="modal__close" onClick={() => setShowConflictoModal(false)}>✕</button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.4', margin: '0 0 14px 0' }}>
                De acuerdo con las regulaciones de la plataforma CEISH, si usted tiene conflicto de interés (co-autoría, afinidad, asesoría directa, etc.) con los autores u objetos de este proyecto, debe reportarlo para inhibirse formalmente de participar en su evaluación.
              </p>
              <div className="modal__field">
                <label className="modal__label">Motivo o causa de su conflicto de interés *</label>
                <textarea 
                  className="modal__textarea"
                  required
                  rows={4}
                  placeholder="Detalle los motivos por los cuales no puede realizar la evaluación de manera neutral..."
                  value={conflictoComentario}
                  onChange={(e) => setConflictoComentario(e.target.value)}
                />
              </div>
            </div>
            <div className="modal__footer">
              <button className="eval-btn eval-btn--outline" onClick={() => setShowConflictoModal(false)}>Cancelar</button>
              <button 
                className="eval-btn eval-btn--primary" 
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
                onClick={handleInhibirse}
                disabled={!conflictoComentario.trim()}
              >
                Inhibirse (Emitir Anexo 23)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Devolver para Corrección (Sección 3.8) */}
      {showDevolverModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowDevolverModal(false); }}>
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title" style={{ color: '#e29400' }}>Devolver Proyecto para Corrección</h2>
              <button className="modal__close" onClick={() => setShowDevolverModal(false)}>✕</button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.4', margin: '0 0 14px 0' }}>
                Mueva el proyecto de vuelta al Investigador en estado de borrador para que pueda corregir los puntos metodológicos o documentos faltantes que le indique abajo.
              </p>
              <div className="modal__field">
                <label className="modal__label">Observaciones y Puntos a corregir *</label>
                <textarea 
                  className="modal__textarea"
                  required
                  rows={5}
                  placeholder="Detalle exactamente qué correcciones o justificaciones debe ingresar el investigador para que el protocolo sea evaluable..."
                  value={devolucionComentario}
                  onChange={(e) => setDevolucionComentario(e.target.value)}
                />
              </div>
            </div>
            <div className="modal__footer">
              <button className="eval-btn eval-btn--outline" onClick={() => setShowDevolverModal(false)}>Cancelar</button>
              <button 
                className="eval-btn eval-btn--primary" 
                style={{ background: '#e29400', borderColor: '#e29400' }}
                onClick={handleDevolverProyecto}
                disabled={!devolucionComentario.trim()}
              >
                Devolver Proyecto (Estado Borrador)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
