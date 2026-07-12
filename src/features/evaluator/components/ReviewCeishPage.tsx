import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useCeishStore } from '../../../store/ceishStore';
import { ceishService } from '../../../services/ceishService';
import { resolverDependenciasAnexo } from '../../../shared/utils/anexoDependencies';
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
    elevarRiesgo,
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
  const [conflictoDeclaracion, setConflictoDeclaracion] = useState(false);

  const [showBajaModal, setShowBajaModal] = useState(false);
  const [bajaMotivo, setBajaMotivo] = useState('');
  const [bajaDeclaracion, setBajaDeclaracion] = useState(false);
  
  const [showDevolverModal, setShowDevolverModal] = useState(false);
  const [devolucionComentario, setDevolucionComentario] = useState('');

  const [showEscalarModal, setShowEscalarModal] = useState(false);
  const [escalamientoComentario, setEscalamientoComentario] = useState('');

  const [nuevoRiesgoEleccion, setNuevoRiesgoEleccion] = useState<RiesgoTipo>('riesgo-minimo');

  // Modal de revisión de Anexos del Investigador
  const [showInvestigadorModal, setShowInvestigadorModal] = useState(false);
  const [selectedInvestigadorAnexoId, setSelectedInvestigadorAnexoId] = useState<string | null>(null);
  const [isEditingInvestigadorAnexos, setIsEditingInvestigadorAnexos] = useState(false);
  const [investigadorFormState, setInvestigadorFormState] = useState<Record<string, any>>({});

  // Edición de anotaciones individuales e historial de rondas
  const [editingAnotacionId, setEditingAnotacionId] = useState<string | null>(null);
  const [editingAnotacionTexto, setEditingAnotacionTexto] = useState('');
  const [showHistorialRondasModal, setShowHistorialRondasModal] = useState(false);

  // Visor PDF (se sirve desde MinIO vía el mismo origen)
  const pdf = usePDFViewer();
  const { loadFile } = pdf;
  const latestVersion = documento?.versionesArchivo.slice(-1)[0];
  const pdfUrl = latestVersion ? ceishService.getFileRawUrl(latestVersion.documentPath) : null;

  useEffect(() => {
    if (pdfUrl) {
      loadFile(pdfUrl);
    }
  }, [pdfUrl, loadFile]);

  // Regla de Reset de Estado al cargar una nueva investigación o versión de archivo
  useEffect(() => {
    setAnotaciones([]);
    setNuevoComentarioTexto('');
    setDevolucionComentario('');
    setConflictoComentario('');
    setEscalamientoComentario('');
    setRespuestasForm({});
  }, [investigacionId, latestVersion?.id]);

  // NOTA: los 3 efectos siguientes viven aquí (antes de los `return` tempranos
  // de abajo) a propósito — `documentos` ahora se carga async desde el
  // servidor, así que en el primer render `documento` puede ser `undefined`
  // y estos hooks deben ejecutarse siempre en el mismo orden en cada render
  // (Rules of Hooks). Cada uno se autoguarda con `if (!documento) return;`.

  // Cargar respuestas de los anexos del investigador al formulario de edición local
  useEffect(() => {
    if (!documento) return;
    if (selectedInvestigadorAnexoId && latestVersion) {
      const respGuardada = respuestasAnexos.find(
        r => r.documentoId === documento.id && r.anexoTemplateId === selectedInvestigadorAnexoId && r.versionArchivoId === latestVersion.id
      );

      const iniciales: Record<string, any> = {};
      const template = anexosTemplates.find(t => t.id === selectedInvestigadorAnexoId);

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
        template?.preguntas.forEach(p => {
          iniciales[p.id] = p.tipo === 'checklist' ? false : p.tipo === 'archivo' ? null : p.tipo === 'seleccion-multiple' ? [] : '';
        });
      }
      setInvestigadorFormState(iniciales);
    }
  }, [documento, selectedInvestigadorAnexoId, latestVersion?.id, respuestasAnexos, anexosTemplates]);

  // Cargar borrador/respuestas del anexo activo en memoria al cambiar de pestaña
  useEffect(() => {
    if (!documento) return;
    if (activeAnexoId && latestVersion) {
      const respGuardada = respuestasAnexos.find(
        r => r.documentoId === documento.id && r.anexoTemplateId === activeAnexoId && r.versionArchivoId === latestVersion.id
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
        template?.preguntas.forEach(p => {
          iniciales[p.id] = p.tipo === 'checklist' ? false : p.tipo === 'archivo' ? null : p.tipo === 'seleccion-multiple' ? [] : '';
        });
      }
      setRespuestasForm(iniciales);
    }
  }, [documento, activeAnexoId, latestVersion?.id, respuestasAnexos, anexosTemplates]);

  // Cargar observaciones o respuestas a nivel de página del PDF para este anexo si ya fueron guardadas
  useEffect(() => {
    if (!documento) return;
    if (activeAnexoId && latestVersion) {
      const respGuardada = respuestasAnexos.find(
        r => r.documentoId === documento.id && r.anexoTemplateId === activeAnexoId && r.versionArchivoId === latestVersion.id
      );
      if (respGuardada) {
        setAnotaciones(respGuardada.comentariosAnotados.map(c => ({ ...c })));
      }
    }
  }, [documento, activeAnexoId, latestVersion?.id]);

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

  const requisitosAnexo = (anexoTemplateId: string) =>
    resolverDependenciasAnexo(anexoTemplateId, tipoDoc.secciones.flatMap(s => s.anexos), respuestasAnexos, documento.id, latestVersion?.id);

  // Autoseleccionar el primer anexo asignado a la sección
  if (!activeAnexoId && activeSeccion && activeSeccion.anexos.length > 0) {
    setActiveAnexoId(activeSeccion.anexos[0].anexoTemplateId);
  }

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

  const handleStartEditAnotacion = (id: string, texto: string) => {
    setEditingAnotacionId(id);
    setEditingAnotacionTexto(texto);
  };

  const handleGuardarEditAnotacion = (id: string) => {
    if (!editingAnotacionTexto.trim()) return;
    setAnotaciones(prev => prev.map(a => a.id === id ? { ...a, texto: editingAnotacionTexto.trim() } : a));
    setEditingAnotacionId(null);
    setEditingAnotacionTexto('');
  };

  const handleCancelarEditAnotacion = () => {
    setEditingAnotacionId(null);
    setEditingAnotacionTexto('');
  };

  // Guardar Borrador
  const handleGuardarBorrador = async () => {
    if (!activeAnexoId || !latestVersion) return;

    const valores: ValorCampo[] = Object.keys(respuestasForm).map(key => ({
      campoId: key,
      valor: respuestasForm[key]
    }));

    try {
      await guardarRespuestaAnexo({
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
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al guardar el borrador.');
    }
  };

  // ============================================================================
  // DISPARADORES DE ACCIÓN (Mapeados por Anexo ID en Estratificación)
  // ============================================================================

  // ACCIÓN 1: Confirmar Sin Riesgo (Emite Anexo 27 y Carta Exención Anexo 11)
  const handleConfirmarExencion = async () => {
    const justificacionText = respuestasForm[Object.keys(respuestasForm).slice(-1)[0]] || '';
    if (!justificacionText.trim()) {
      return alert('Debe completar la justificación/criterio final del anexo de estratificación.');
    }

    if (!window.confirm('¿Está seguro de que desea confirmar la Estratificación del proyecto y avanzar a la pestaña del Anexo 11?')) {
      return;
    }

    const versionId = latestVersion?.id || '';
    const valoresA27: ValorCampo[] = Object.keys(respuestasForm).map(key => ({
      campoId: key,
      valor: respuestasForm[key]
    }));

    try {
      // 1. Emitir Anexo 27 (manteniendo en la etapa actual de estratificacion)
      await emitirAnexo(
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
        'estratificacion',
        'Estratificación de riesgo completada: Confirmado sin riesgo.',
        'sin-riesgo'
      );

      window.alert('Estratificación registrada. Proceda a llenar el Formato de Carta de Exención (Anexo 11) para finalizar esta etapa.');
      setActiveAnexoId('anexo-11');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al confirmar la estratificación.');
    }
  };

  // ACCIÓN 2: Elevar Riesgo — pasa a Revisión Técnica con 2 evaluadores nuevos
  const handleElevarRiesgo = async () => {
    const justificacionText = respuestasForm[Object.keys(respuestasForm).slice(-1)[0]] || '';
    if (!justificacionText.trim()) {
      return alert('Debe detallar la justificación técnica de la reclasificación.');
    }
    if (!window.confirm(`¿Confirma reclasificar el riesgo a "${nuevoRiesgoEleccion.replace('-', ' ')}" y enviar el proyecto a Revisión Técnica con 2 evaluadores?`)) {
      return;
    }

    try {
      await elevarRiesgo(documento.id, currentUser.id, currentUser.name, nuevoRiesgoEleccion, justificacionText);
      window.alert('Riesgo reclasificado. El proyecto pasó a Revisión Técnica con 2 evaluadores asignados.');
      navigate('/evaluador');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al reclasificar el riesgo.');
    }
  };

  const handleDarDeBajaConfirm = async () => {
    if (!bajaMotivo.trim()) {
      return alert('Debe especificar la causa de la baja definitiva.');
    }
    const versionId = latestVersion?.id || '';

    try {
      await emitirAnexo(
        {
          anexoTemplateId: 'anexo-26',
          documentoId: documento.id,
          seccionId: activeSeccion.id,
          versionArchivoId: versionId,
          emitidoPorId: currentUser.id,
          emitidoPorNombre: currentUser.name,
          valores: [
            { campoId: 'a26_c1', valor: bajaMotivo.trim() },
            { campoId: 'a26_c2', valor: bajaDeclaracion }
          ],
          comentariosAnotados: []
        },
        'baja',
        'anulada',
        `Proyecto dado de baja definitiva del CEISH. Causa: ${bajaMotivo.trim()}`
      );

      window.alert('Expediente anulado / suspendido definitivamente (Anexo 26).');
      setShowBajaModal(false);
      navigate('/evaluador');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al dar de baja el proyecto.');
    }
  };

  // ACCIÓN 3: Inhibición por Conflicto (Anexo 23)
  const handleDeclararConflicto = async () => {
    if (!conflictoComentario.trim()) {
      return alert('Describa detalladamente la causa de su conflicto de interés.');
    }

    try {
      await darseDeBajaRevisor(documento.id, currentUser.id, currentUser.name, conflictoComentario.trim());
      window.alert('Se ha registrado su conflicto de interés (Anexo 23). La plataforma lo ha retirado de este proyecto y asignado otro revisor para continuar en la misma etapa.');
      navigate('/evaluador');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al declarar el conflicto de interés.');
    }
  };

  // ACCIÓN 3.5: Inhibición Directa desde Pestaña Anexo 23
  const isAnexo23Valido = () => {
    // 1. Deben estar respondidos los anexos previos configurados como requisito (p. ej. Anexo 11)
    if (!requisitosAnexo('anexo-23').desbloqueado) return false;

    // 2. Debe detallarse la causa del conflicto (campos 'texto-libre' de Anexo 23)
    const template23 = anexosTemplates.find(t => t.id === 'anexo-23');
    if (!template23) return false;

    const tieneTextoLibreVacio = template23.preguntas.some(p => {
      if (p.tipo === 'texto-libre') {
        const val = respuestasForm[p.id];
        return !val || !val.trim();
      }
      return false;
    });

    return !tieneTextoLibreVacio;
  };

  const handleDeclararConflictoDirect = async () => {
    if (!isAnexo23Valido()) return;

    if (!window.confirm('¿Está seguro de que desea declarar su conflicto de interés formalmente (Anexo 23)? Esto lo desvinculará del trámite.')) {
      return;
    }

    const template = anexosTemplates.find(t => t.id === 'anexo-23');
    if (!template) return;

    const qTexto = template.preguntas.find(p => p.tipo === 'texto-libre' || p.key === 'observaciones');
    const textoVal = qTexto ? respuestasForm[qTexto.id] : '';

    try {
      await darseDeBajaRevisor(documento.id, currentUser.id, currentUser.name, textoVal.trim());
      window.alert('Se ha registrado su conflicto de interés (Anexo 23). Se asignó un nuevo revisor para continuar en la misma etapa.');
      navigate('/evaluador');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al declarar el conflicto de interés.');
    }
  };

  // ACCIÓN 1.5: Finalizar Exención Ética (Anexo 11)
  const isAnexo11Valido = () => {
    // 1. Deben estar respondidos los anexos previos configurados como requisito (p. ej. Anexo 27)
    if (!requisitosAnexo('anexo-11').desbloqueado) return false;

    // 2. Deben llenarse los campos obligatorios (únicamente 'texto-libre') de la plantilla actual de Anexo 11
    const template11 = anexosTemplates.find(t => t.id === 'anexo-11');
    if (!template11) return false;

    const tieneTextoLibreVacio = template11.preguntas.some(p => {
      if (p.tipo === 'texto-libre') {
        const val = respuestasForm[p.id];
        return !val || !val.trim();
      }
      return false;
    });

    return !tieneTextoLibreVacio;
  };

  const handleCompletarExencionEtapa = async () => {
    if (!isAnexo11Valido()) return;

    if (!window.confirm('¿Está seguro de que desea emitir la Carta de Exención Ética (Anexo 11) y avanzar el proyecto a la etapa de Revisión Técnica?')) {
      return;
    }

    const template = anexosTemplates.find(t => t.id === 'anexo-11');
    if (!template) return;

    const versionId = latestVersion?.id || '';
    const valores = template.preguntas.map(p => ({
      campoId: p.id,
      valor: respuestasForm[p.id]
    }));

    try {
      await emitirAnexo(
        {
          anexoTemplateId: 'anexo-11',
          documentoId: documento.id,
          seccionId: activeSeccion.id,
          versionArchivoId: versionId,
          emitidoPorId: currentUser.id,
          emitidoPorNombre: currentUser.name,
          valores: valores,
          comentariosAnotados: []
        },
        'aprobado',
        'revision-tecnica',
        'Carta de exención emitida. El proyecto pasa a revisión técnica (Etapa 2).',
        'sin-riesgo'
      );

      window.alert('Se ha emitido la exención de revisión ética (Anexo 11). Trámite pasa a Revisión Técnica.');
      navigate('/evaluador');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al emitir la carta de exención.');
    }
  };

  // ACCIÓN 4: Devolver para Observaciones (Etapa 2)
  const handleDevolverInvestigador = async () => {
    if (!devolucionComentario.trim()) {
      return alert('Debe ingresar un comentario indicando las observaciones.');
    }

    const versionId = latestVersion?.id || '';

    try {
      // Emitir Anexo 27 con observaciones
      await emitirAnexo(
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
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al devolver el proyecto al investigador.');
    }
  };

  // ACCIÓN 5: Escalar al Administrador
  const handleEscalarAdmin = async () => {
    if (!escalamientoComentario.trim()) {
      return alert('Escriba la causa del escalamiento.');
    }

    try {
      // Guardar borrador del anexo primero
      await handleGuardarBorrador();

      // Encontrar borrador guardado para ligarlo
      const versionId = latestVersion?.id || '';
      const resp = respuestasAnexos.find(
        r => r.documentoId === documento.id && r.anexoTemplateId === activeAnexoId && r.versionArchivoId === versionId
      );

      await crearEscalamiento(
        documento.id,
        activeSeccion.id,
        activeAnexoId || '',
        escalamientoComentario.trim(),
        resp?.id || ''
      );

      window.alert('Escalamiento registrado. El administrador revisará y editará el anexo. El proceso sigue corriendo en paralelo.');
      setShowEscalarModal(false);
      setEscalamientoComentario('');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al registrar el escalamiento.');
    }
  };

  // ============================================================================
  // DISPARADORES DE ACCIÓN (Mapeados por Anexo ID en Evaluación Técnica)
  // ============================================================================

  // El Anexo 12 ya fue devuelto con observaciones para la versión de archivo
  // vigente: no debe poder volver a aprobarse/rechazarse hasta que el
  // investigador suba una corrección (lo que genera una nueva versión y hace
  // que esta respuesta deje de coincidir automáticamente).
  const anexo12ConObservacionesPendiente = respuestasAnexos.some(
    r => r.documentoId === documento.id && r.anexoTemplateId === 'anexo-12' && r.resultado === 'con-observaciones' && r.versionArchivoId === latestVersion?.id
  );

  // ACCIÓN A: Aprobar Metodológicamente (Emisión de Anexo 12, redirige a Anexo 13)
  const isAnexo12Valido = () => {
    if (!requisitosAnexo('anexo-12').desbloqueado) return false;
    if (anexo12ConObservacionesPendiente) return false;

    const template12 = anexosTemplates.find(t => t.id === 'anexo-12');
    if (!template12) return false;

    // Buscar si alguna pregunta de tipo 'texto-libre' está vacía
    const tieneTextoLibreVacio = template12.preguntas.some(p => {
      if (p.tipo === 'texto-libre') {
        const val = respuestasForm[p.id];
        return !val || !val.trim();
      }
      return false;
    });

    return !tieneTextoLibreVacio;
  };

  const handleAprobarMetodologico = async () => {
    if (!isAnexo12Valido()) return;

    if (!window.confirm('¿Está seguro de que desea aprobar técnicamente el Anexo 12 y avanzar a la Resolución Final (Anexo 13)?')) {
      return;
    }

    const versionId = latestVersion?.id || '';
    const valoresA12 = Object.keys(respuestasForm).map(key => ({
      campoId: key,
      valor: respuestasForm[key]
    }));

    try {
      // Emitir Anexo 12 con resultado aprobado, pero mantener en revisión técnica
      await emitirAnexo(
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
        'revision-tecnica',
        'Evaluación técnica del Anexo 12 aprobada. Continuando a la emisión de la Resolución (Anexo 13).'
      );

      window.alert('Evaluación técnica del Anexo 12 aprobada con éxito. Proceda a llenar la Resolución (Anexo 13).');
      setActiveAnexoId('anexo-13');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al aprobar el Anexo 12.');
    }
  };

  // Validaciones y triggers para Anexo 13 y Anexo 26
  const isAnexo13Valido = () => {
    // 1. Deben estar respondidos los anexos previos configurados como requisito (p. ej. Anexo 12)
    if (!requisitosAnexo('anexo-13').desbloqueado) return false;

    // 2. Regla de negocio específica: el Anexo 12 debe estar además APROBADO (no solo respondido)
    const anexo12Aprobado = respuestasAnexos.some(
      r => r.documentoId === documento.id && r.anexoTemplateId === 'anexo-12' && r.resultado === 'aprobado' && r.versionArchivoId === latestVersion?.id
    );
    if (!anexo12Aprobado) return false;

    // 3. Deben llenarse los campos obligatorios (únicamente 'texto-libre') del Anexo 13
    const template13 = anexosTemplates.find(t => t.id === 'anexo-13');
    if (!template13) return false;

    const tieneTextoLibreVacio = template13.preguntas.some(p => {
      if (p.tipo === 'texto-libre') {
        const val = respuestasForm[p.id];
        return !val || !val.trim();
      }
      return false;
    });

    return !tieneTextoLibreVacio;
  };

  const handleCompletarAprobacionFinal = async () => {
    if (!isAnexo13Valido()) return;

    if (!window.confirm('¿Está seguro de que desea emitir la Resolución de Aprobación Final (Anexo 13) y finalizar el trámite del proyecto?')) {
      return;
    }

    const template = anexosTemplates.find(t => t.id === 'anexo-13');
    if (!template) return;

    const versionId = latestVersion?.id || '';
    const valores = template.preguntas.map(p => ({
      campoId: p.id,
      valor: respuestasForm[p.id]
    }));

    try {
      // Emitir Anexo 13 y cambiar estado final a 'aprobada'
      await emitirAnexo(
        {
          anexoTemplateId: 'anexo-13',
          documentoId: documento.id,
          seccionId: activeSeccion.id,
          versionArchivoId: versionId,
          emitidoPorId: currentUser.id,
          emitidoPorNombre: currentUser.name,
          valores,
          comentariosAnotados: []
        },
        'aprobado',
        'aprobada',
        'Emisión oficial de la Resolución de Aprobación del CEISH.'
      );

      window.alert('Resolución de Aprobación emitida con éxito (Anexo 13). Trámite finalizado.');
      navigate('/evaluador');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al emitir la resolución final.');
    }
  };

  const isAnexo26Valido = () => {
    if (!requisitosAnexo('anexo-26').desbloqueado) return false;

    const template26 = anexosTemplates.find(t => t.id === 'anexo-26');
    if (!template26) return false;

    const tieneTextoLibreVacio = template26.preguntas.some(p => {
      if (p.tipo === 'texto-libre') {
        const val = respuestasForm[p.id];
        return !val || !val.trim();
      }
      return false;
    });

    return !tieneTextoLibreVacio;
  };

  const handleCompletarBajaFinal = async () => {
    if (!isAnexo26Valido()) return;

    if (!window.confirm('¿Está seguro de que desea DAR DE BAJA esta investigación definitivamente? Esta acción es irreversible y archivará el expediente.')) {
      return;
    }

    const template = anexosTemplates.find(t => t.id === 'anexo-26');
    if (!template) return;

    const versionId = latestVersion?.id || '';
    const valores = template.preguntas.map(p => ({
      campoId: p.id,
      valor: respuestasForm[p.id]
    }));

    try {
      // Emitir Anexo 26 y cambiar estado final a 'anulada'
      await emitirAnexo(
        {
          anexoTemplateId: 'anexo-26',
          documentoId: documento.id,
          seccionId: activeSeccion.id,
          versionArchivoId: versionId,
          emitidoPorId: currentUser.id,
          emitidoPorNombre: currentUser.name,
          valores,
          comentariosAnotados: []
        },
        'baja',
        'anulada',
        'Proyecto dado de baja o suspendido oficialmente.'
      );

      window.alert('Expediente anulado / suspendido definitivamente (Anexo 26).');
      navigate('/evaluador');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al dar de baja el proyecto.');
    }
  };

  // ACCIÓN B: No Aprobar (Devolver con observaciones, mantiene revisión técnica)
  const handleNoAprobarDevolver = async () => {
    if (anotaciones.length === 0) return;
    if (anexo12ConObservacionesPendiente) return;

    if (!window.confirm('¿Está seguro de que desea no aprobar el proyecto y devolverlo al investigador con observaciones?')) {
      return;
    }

    const versionId = latestVersion?.id || '';
    const valoresA12 = Object.keys(respuestasForm).map(key => ({
      campoId: key,
      valor: respuestasForm[key]
    }));

    try {
      // Emitir Anexo 12 con observaciones, mantiene estado 'revision-tecnica'
      await emitirAnexo(
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
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al devolver el proyecto con observaciones.');
    }
  };

  // ACCIÓN C: Dar de Baja Proyecto (Anexo 26)
  const handleDarDeBaja = () => {
    setBajaMotivo('');
    setBajaDeclaracion(false);
    setShowBajaModal(true);
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
          {pdfUrl ? (
            <PDFViewer
              file={pdfUrl}
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
              <h4>Sin documento asociado</h4>
              <p>Este trámite todavía no tiene ninguna versión de archivo cargada.</p>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '16px', borderRadius: '8px', width: '100%', textAlign: 'center' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px', display: 'inline-block' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#1e3a8a', fontWeight: 700 }}>Revisión de Anexos del Investigador</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#1e40af', lineHeight: '1.4' }}>
                  Acceda a los anexos obligatorios llenados por el investigador (Etapa 1: Creación) para auditar y, si es necesario, editar sus respuestas.
                </p>
                <button
                  type="button"
                  className="eval-btn eval-btn--primary"
                  onClick={() => {
                    const firstSection = tipoDoc.secciones[0];
                    if (firstSection && firstSection.anexos.length > 0) {
                      setSelectedInvestigadorAnexoId(firstSection.anexos[0].anexoTemplateId);
                    }
                    setShowInvestigadorModal(true);
                  }}
                  style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Revisar Anexos del Investigador
                </button>
              </div>
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
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1e293b', flex: 1 }}>
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
                          ) : p.tipo === 'archivo' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
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
                                    handlePreguntaChange(p.id, { documentName: f.name, documentPath });
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
                                onClick={() => handlePreguntaChange(p.id, 'SI')}
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
                                onClick={() => handlePreguntaChange(p.id, 'NO')}
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
                                  onClick={() => handlePreguntaChange(p.id, op)}
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
                                    onClick={() => handlePreguntaChange(p.id, active ? arr.filter((o: string) => o !== op) : [...arr, op])}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                          {anotaciones.length === 0 ? (
                            <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontStyle: 'italic' }}>
                              Ninguna anotación específica registrada.
                            </p>
                          ) : (
                            anotaciones.map((anot) => (
                              <div key={anot.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '11.5px' }}>
                                {editingAnotacionId === anot.id ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      value={editingAnotacionTexto}
                                      onChange={(e) => setEditingAnotacionTexto(e.target.value)}
                                      style={{ fontSize: '11px', padding: '4px', width: '100%' }}
                                    />
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        className="eval-btn eval-btn--sm eval-btn--outline"
                                        onClick={handleCancelarEditAnotacion}
                                        style={{ fontSize: '10.5px', padding: '2px 8px' }}
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        type="button"
                                        className="eval-btn eval-btn--sm eval-btn--primary"
                                        onClick={() => handleGuardarEditAnotacion(anot.id)}
                                        style={{ fontSize: '10.5px', padding: '2px 8px' }}
                                      >
                                        Guardar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ flex: 1, color: '#334155', lineHeight: '1.4' }}>
                                      <strong>Pág. {anot.paginaPdf}:</strong> "{anot.texto}"
                                    </span>
                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditAnotacion(anot.id, anot.texto)}
                                        title="Editar anotación"
                                        style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEliminarAnotacion(anot.id)}
                                        title="Eliminar anotación"
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 'bold' }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                )}
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
                      <div style={{ borderTop: '1.5px solid #cbd5e1', paddingTop: '12px', marginTop: '12px' }}>
                        <button
                          type="button"
                          className="eval-btn eval-btn--outline"
                          onClick={() => setShowHistorialRondasModal(true)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', borderColor: '#2563eb', color: '#2563eb' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          Ver Historial de Rondas Anteriores ({rondasPreviasA12.length})
                        </button>
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
                          <span style={{ fontSize: '10.5px', color: '#1e40af' }}>✓ Confirma la estratificación del proyecto y avanza a la pestaña del Anexo 11 para emitir la exención.</span>
                        </div>

                        {/* Opción 2: Devolución */}
                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #bfdbfe', paddingTop: '10px' }}>
                          <button 
                            type="button" 
                            className="eval-btn eval-btn--outline" 
                            onClick={() => setShowDevolverModal(true)} 
                            style={{ width: '100%', borderColor: '#d97706', color: '#d97706' }}
                          >
                            Devolver para Correcciones
                          </button>
                        </div>

                        {/* Opción 3: Elevar Riesgo */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #bfdbfe', paddingTop: '10px' }}>
                          <select
                            className="form-input"
                            value={nuevoRiesgoEleccion}
                            onChange={(e) => setNuevoRiesgoEleccion(e.target.value as RiesgoTipo)}
                          >
                            <option value="riesgo-minimo">Riesgo Mínimo</option>
                            <option value="riesgo-mayor">Riesgo Mayor</option>
                          </select>
                          <button
                            type="button"
                            className="eval-btn"
                            onClick={handleElevarRiesgo}
                            style={{ width: '100%', backgroundColor: '#d97706', color: 'white' }}
                          >
                            Elevar Riesgo y Enviar a Revisión Técnica
                          </button>
                          <span style={{ fontSize: '10.5px', color: '#92400e' }}>⚠ Asigna 2 evaluadores nuevos para revisión técnica y saca al proyecto del camino corto de exención.</span>
                        </div>
                      </div>
                    )}

                    {/* ACCIONES DE EXENCIÓN ÉTICA (Anexo 11) */}
                    {documento.estado === 'estratificacion' && activeAnexoId === 'anexo-11' && (
                      <div style={{ borderTop: '1.5px solid #cbd5e1', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#166534' }}>Aprobación de Exención Ética (Anexo 11)</h4>
                        
                        <button 
                          type="button" 
                          className="eval-btn" 
                          onClick={handleCompletarExencionEtapa} 
                          disabled={!isAnexo11Valido()}
                          style={{ 
                            width: '100%', 
                            backgroundColor: isAnexo11Valido() ? '#16a34a' : '#cbd5e1', 
                            color: isAnexo11Valido() ? 'white' : '#94a3b8',
                            cursor: isAnexo11Valido() ? 'pointer' : 'not-allowed',
                            fontWeight: 600
                          }}
                        >
                          Pasar Proyecto a Siguiente Etapa (Revisión Técnica)
                        </button>
                        {!isAnexo11Valido() && (
                          <span style={{ fontSize: '10.5px', color: '#9c400c', fontWeight: 500, textAlign: 'center' }}>
                            (Se habilitará solo si el Anexo 27 está completo y se llenó la justificación técnica en este formulario)
                          </span>
                        )}
                      </div>
                    )}

                    {/* ACCIONES DE CONFLICTO (Anexo 23) */}
                    {activeAnexoId === 'anexo-23' && (
                      <div style={{ borderTop: '1.5px solid #cbd5e1', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#fef2f2', padding: '14px', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#991b1b' }}>Declaración de Conflicto de Interés (Anexo 23)</h4>
                        
                        <button 
                          type="button" 
                          className="eval-btn" 
                          onClick={handleDeclararConflictoDirect}
                          disabled={!isAnexo23Valido()}
                          style={{ 
                            width: '100%', 
                            backgroundColor: isAnexo23Valido() ? '#ef4444' : '#cbd5e1', 
                            color: isAnexo23Valido() ? 'white' : '#94a3b8',
                            cursor: isAnexo23Valido() ? 'pointer' : 'not-allowed',
                            fontWeight: 600
                          }}
                        >
                          Confirmar Inhibición y Salir del Trámite
                        </button>
                        {!isAnexo23Valido() && (
                          <span style={{ fontSize: '10.5px', color: '#991b1b', fontWeight: 500, textAlign: 'center' }}>
                            (Se habilitará solo si el Anexo 27 está completo, los campos obligatorios del Anexo 11 están llenos, y se detalla la causa de conflicto en este formulario)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Plazo de corrección del Anexo 12 (verificación al vuelo, sin cron) */}
                    {documento.estado === 'revision-tecnica' && documento.cronometro?.fechaLimiteCorreccion && (() => {
                      const fechaLimite = documento.cronometro!.fechaLimiteCorreccion!;
                      const vencido = new Date() > new Date(fechaLimite);
                      return (
                        <div style={{
                          padding: '10px', borderRadius: '6px',
                          background: vencido ? '#fef2f2' : '#fffbeb',
                          border: `1px solid ${vencido ? '#fca5a5' : '#fde68a'}`,
                          fontSize: '11.5px', color: vencido ? '#991b1b' : '#92400e',
                        }}>
                          {vencido
                            ? `⚠️ Plazo de corrección vencido (venció el ${new Date(fechaLimite).toLocaleDateString('es-ES')}). Puede anularse por incumplimiento desde la pestaña Anexo 26.`
                            : `⏳ El investigador tiene hasta el ${new Date(fechaLimite).toLocaleDateString('es-ES')} para corregir.`}
                        </div>
                      );
                    })()}

                    {/* ACCIONES DE EVALUACIÓN TÉCNICA (Etapa 3) */}
                    {documento.estado === 'revision-tecnica' && activeAnexoId === 'anexo-12' && (
                      <div style={{ borderTop: '1.5px solid #cbd5e1', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#334155' }}>Dictamen de Revisión Metodológica</h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* Botón A: Aprobar Proyecto */}
                          <button 
                            type="button" 
                            className="eval-btn" 
                            onClick={handleAprobarMetodologico} 
                            disabled={!isAnexo12Valido()}
                            style={{ 
                              width: '100%', 
                              backgroundColor: isAnexo12Valido() ? '#16a34a' : '#cbd5e1', 
                              color: isAnexo12Valido() ? 'white' : '#94a3b8',
                              cursor: isAnexo12Valido() ? 'pointer' : 'not-allowed',
                              fontWeight: 600
                            }}
                          >
                            Confirmar Aprobación Técnica (Anexo 13)
                          </button>
                          {!isAnexo12Valido() && (
                            <span style={{ fontSize: '10.5px', color: '#9c400c', fontWeight: 500, textAlign: 'center', marginBottom: '6px' }}>
                              {anexo12ConObservacionesPendiente
                                ? '(Ya se devolvió esta versión con observaciones — espere a que el investigador suba la corrección)'
                                : '(Se habilitará solo si se completan las observaciones generales obligatorias de este formulario)'}
                            </span>
                          )}

                          {/* Botón B: No Aprobar (Devolver con observaciones) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <button
                              type="button"
                              className="eval-btn eval-btn--outline"
                              onClick={handleNoAprobarDevolver}
                              disabled={anotaciones.length === 0 || anexo12ConObservacionesPendiente}
                              style={{ width: '100%', borderColor: '#d97706', color: '#d97706' }}
                            >
                              No Aprobar (Devolver con Observaciones)
                            </button>
                            {anexo12ConObservacionesPendiente ? (
                              <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 600, textAlign: 'center' }}>
                                (Ya se devolvió esta versión con observaciones — espere a que el investigador suba la corrección)
                              </span>
                            ) : anotaciones.length === 0 && (
                              <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 600, textAlign: 'center' }}>
                                (Requiere agregar al menos una observación por página en el panel superior)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ACCIONES DE APROBACIÓN (Anexo 13) */}
                    {documento.estado === 'revision-tecnica' && activeAnexoId === 'anexo-13' && (
                      <div style={{ borderTop: '1.5px solid #cbd5e1', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#166534' }}>Aprobación y Resolución Final (Anexo 13)</h4>
                        
                        <button 
                          type="button" 
                          className="eval-btn" 
                          onClick={handleCompletarAprobacionFinal} 
                          disabled={!isAnexo13Valido()}
                          style={{ 
                            width: '100%', 
                            backgroundColor: isAnexo13Valido() ? '#16a34a' : '#cbd5e1', 
                            color: isAnexo13Valido() ? 'white' : '#94a3b8',
                            cursor: isAnexo13Valido() ? 'pointer' : 'not-allowed',
                            fontWeight: 600
                          }}
                        >
                          Emitir Resolución y Aprobar Proyecto
                        </button>
                        {!isAnexo13Valido() && (
                          <span style={{ fontSize: '10.5px', color: '#9c400c', fontWeight: 500, textAlign: 'center' }}>
                            (Se habilitará solo si el Anexo 12 fue aprobado y se llenan los campos obligatorios de este formulario)
                          </span>
                        )}
                      </div>
                    )}

                    {/* ACCIONES DE BAJA/SUSPENSIÓN (Anexo 26) */}
                    {documento.estado === 'revision-tecnica' && activeAnexoId === 'anexo-26' && (
                      <div style={{ borderTop: '1.5px solid #cbd5e1', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#fef2f2', padding: '14px', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#991b1b' }}>Dar de Baja / Suspender Proyecto (Anexo 26)</h4>
                        
                        <button 
                          type="button" 
                          className="eval-btn" 
                          onClick={handleCompletarBajaFinal} 
                          disabled={!isAnexo26Valido()}
                          style={{ 
                            width: '100%', 
                            backgroundColor: isAnexo26Valido() ? '#ef4444' : '#cbd5e1', 
                            color: isAnexo26Valido() ? 'white' : '#94a3b8',
                            cursor: isAnexo26Valido() ? 'pointer' : 'not-allowed',
                            fontWeight: 600
                          }}
                        >
                          Confirmar Baja y Archivar Expediente
                        </button>
                        {!isAnexo26Valido() && (
                          <span style={{ fontSize: '10.5px', color: '#991b1b', fontWeight: 500, textAlign: 'center' }}>
                            (Se habilitará solo si se ingresa la justificación en el formulario superior)
                          </span>
                        )}
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
              <h3 className="modal__title">Declaración de Conflicto de Intereses (Anexo 23)</h3>
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                Complete el formulario de la plantilla oficial de conflicto de interés para generar el documento y confirmar su inhibición.
              </p>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Causa de su conflicto de interés con el proyecto o sus autores:
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={conflictoComentario}
                  onChange={(e) => setConflictoComentario(e.target.value)}
                  placeholder="Escriba la causa de inhibición aquí..."
                  required
                  style={{ fontSize: '12px', marginTop: '4px' }}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <input
                    type="checkbox"
                    checked={conflictoDeclaracion}
                    onChange={(e) => setConflictoDeclaracion(e.target.checked)}
                  />
                  <span>Declaración juramentada de inhibición en el proceso de evaluación</span>
                </label>
              </div>
            </div>
            <div className="modal__footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="eval-btn eval-btn--outline" onClick={() => setShowConflictoModal(false)}>Cancelar</button>
              <button
                className="eval-btn eval-btn--danger"
                onClick={handleDeclararConflicto}
                disabled={!conflictoComentario.trim() || !conflictoDeclaracion}
              >
                Confirmar Inhibición
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dar de Baja Proyecto (Anexo 26) */}
      {showBajaModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowBajaModal(false); }}>
          <div className="modal" style={{ maxWidth: '450px' }}>
            <div className="modal__header">
              <h3 className="modal__title">Resolución de Suspensión / Revocatoria (Anexo 26)</h3>
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                Complete el formulario de la plantilla oficial de revocatoria para anular definitivamente el expediente del proyecto.
              </p>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Motivos de la suspensión / revocatoria (vencimiento de plazos, faltas éticas, etc.):
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={bajaMotivo}
                  onChange={(e) => setBajaMotivo(e.target.value)}
                  placeholder="Describa los motivos de baja aquí..."
                  required
                  style={{ fontSize: '12px', marginTop: '4px' }}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <input
                    type="checkbox"
                    checked={bajaDeclaracion}
                    onChange={(e) => setBajaDeclaracion(e.target.checked)}
                  />
                  <span>Declaración formal de suspensión de la validez del certificado aprobatorio</span>
                </label>
              </div>
            </div>
            <div className="modal__footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="eval-btn eval-btn--outline" onClick={() => setShowBajaModal(false)}>Cancelar</button>
              <button
                className="eval-btn eval-btn--danger"
                onClick={handleDarDeBajaConfirm}
                disabled={!bajaMotivo.trim() || !bajaDeclaracion}
              >
                Confirmar Baja (A26)
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

      {/* Modal Historial de Rondas Anteriores */}
      {showHistorialRondasModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowHistorialRondasModal(false); }}>
          <div className="modal" style={{ maxWidth: '650px', width: '90%' }}>
            <div className="modal__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px' }}>
              <h3 className="modal__title" style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                Historial de Revisiones (Rondas Anteriores)
              </h3>
              <button 
                type="button" 
                onClick={() => setShowHistorialRondasModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 0', maxHeight: '60vh', overflowY: 'auto' }}>
              {rondasPreviasA12.map((ron, rIdx) => (
                <div key={ron.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Ronda #{rIdx + 1} (Archivo Evaluado: {documento.versionesArchivo.find(v => v.id === ron.versionArchivoId)?.documentName || 'Desconocido'})
                  </p>
                  <p style={{ margin: '2px 0 8px 0', fontSize: '10.5px', color: '#64748b' }}>
                    Evaluado el: {new Date(ron.emitidoAt).toLocaleString()} por {ron.emitidoPorNombre}
                  </p>
                  
                  <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 600, color: '#475569' }}>Observaciones registradas (Modo Lectura):</p>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11.5px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {ron.comentariosAnotados.map(c => (
                        <li key={c.id}>
                          <strong>Pág. {c.paginaPdf}:</strong> "{c.texto}"
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #cbd5e1', paddingTop: '10px' }}>
              <button className="eval-btn eval-btn--primary" onClick={() => setShowHistorialRondasModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de revisión de Anexos del Investigador */}
      {showInvestigadorModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !isEditingInvestigadorAnexos) { setIsEditingInvestigadorAnexos(false); setShowInvestigadorModal(false); } }}>
          <div className="modal" style={{ maxWidth: '850px', width: '90%' }}>
            <div className="modal__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px' }}>
              <h3 className="modal__title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                Revisión de Anexos del Investigador (Etapa 1)
              </h3>
              <button 
                type="button" 
                className="modal__close" 
                onClick={() => {
                  if (isEditingInvestigadorAnexos && !window.confirm('Hay cambios sin guardar. ¿Desea cerrar de todas formas?')) return;
                  setIsEditingInvestigadorAnexos(false);
                  setShowInvestigadorModal(false);
                }} 
                aria-label="Cerrar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0', maxHeight: '60vh', overflowY: 'auto' }}>
              {/* Tabs para seleccionar el anexo */}
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                {(() => {
                  const firstSection = tipoDoc.secciones[0];
                  if (!firstSection) return null;

                  return firstSection.anexos.map(an => {
                    const temp = anexosTemplates.find(t => t.id === an.anexoTemplateId);
                    if (!temp) return null;

                    return (
                      <button
                        key={temp.id}
                        type="button"
                        className={`eval-tabs__btn ${selectedInvestigadorAnexoId === temp.id ? 'active' : ''}`}
                        onClick={() => {
                          if (isEditingInvestigadorAnexos && !window.confirm('Hay cambios sin guardar en el anexo actual. ¿Desea cambiar de pestaña y perder los cambios?')) return;
                          setSelectedInvestigadorAnexoId(temp.id);
                          setIsEditingInvestigadorAnexos(false);
                        }}
                        style={{ fontSize: '12px', padding: '6px 12px', flexShrink: 0 }}
                      >
                        Anexo {temp.numero}
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Contenido del anexo seleccionado */}
              {selectedInvestigadorAnexoId && (() => {
                const template = anexosTemplates.find(t => t.id === selectedInvestigadorAnexoId);
                if (!template) return null;

                const firstSection = tipoDoc.secciones[0];
                const resp = respuestasAnexos.find(
                  r => r.documentoId === documento.id && r.anexoTemplateId === selectedInvestigadorAnexoId && r.versionArchivoId === latestVersion?.id
                );

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                        Anexo {template.numero}: {template.nombre}
                      </h4>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!isEditingInvestigadorAnexos ? (
                          <button
                            type="button"
                            className="eval-btn eval-btn--outline"
                            onClick={() => {
                              // Cargar datos a la edición local por si acaso
                              const iniciales: Record<string, any> = {};
                              if (resp) {
                                resp.valores.forEach(v => {
                                  iniciales[v.campoId] = v.valor;
                                });
                              } else {
                                template.preguntas.forEach(p => {
                                  iniciales[p.id] = p.tipo === 'checklist' ? false : p.tipo === 'archivo' ? null : p.tipo === 'seleccion-multiple' ? [] : '';
                                });
                              }
                              setInvestigadorFormState(iniciales);
                              setIsEditingInvestigadorAnexos(true);
                            }}
                            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                            </svg>
                            Habilitar Edición
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="eval-btn eval-btn--outline"
                              onClick={() => {
                                setIsEditingInvestigadorAnexos(false);
                              }}
                              style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="eval-btn eval-btn--primary"
                              onClick={async () => {
                                const valores: ValorCampo[] = Object.keys(investigadorFormState).map(key => ({
                                  campoId: key,
                                  valor: investigadorFormState[key]
                                }));

                                try {
                                  await guardarRespuestaAnexo({
                                    anexoTemplateId: template.id,
                                    documentoId: documento.id,
                                    seccionId: firstSection?.id || 'sec-creacion',
                                    versionArchivoId: latestVersion?.id || '',
                                    emitidoPorId: resp ? resp.emitidoPorId : currentUser.id,
                                    emitidoPorNombre: resp ? resp.emitidoPorNombre : currentUser.name,
                                    valores,
                                    comentariosAnotados: resp ? resp.comentariosAnotados : []
                                  });

                                  setIsEditingInvestigadorAnexos(false);
                                  window.alert('Cambios guardados con éxito.');
                                } catch (err) {
                                  window.alert(err instanceof Error ? err.message : 'Error al guardar los cambios.');
                                }
                              }}
                              style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                              Guardar Cambios
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {template.preguntas.map((p) => {
                        const currentVal = investigadorFormState[p.id];

                        return (
                          <div key={p.id} style={{ background: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                            {p.descripcionContexto && (
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px', display: 'block' }}>
                                [{p.descripcionContexto}]
                              </span>
                            )}
                            <p style={{ margin: '0 0 8px 0', fontSize: '12.5px', fontWeight: 600, color: '#475569', lineHeight: '1.4' }}>{p.texto}</p>

                            {isEditingInvestigadorAnexos ? (
                              // RENDERIZADO EDICIÓN HABILITADA
                              p.tipo === 'texto-libre' ? (
                                <textarea
                                  className="form-input"
                                  rows={3}
                                  value={currentVal || ''}
                                  onChange={(e) => setInvestigadorFormState(prev => ({ ...prev, [p.id]: e.target.value }))}
                                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                                />
                              ) : p.tipo === 'archivo' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                                        setInvestigadorFormState(prev => ({ ...prev, [p.id]: { documentName: f.name, documentPath } }));
                                      } catch (err) {
                                        window.alert(err instanceof Error ? err.message : 'Error al subir el archivo.');
                                      }
                                    }}
                                    style={{ fontSize: '12px' }}
                                  />
                                  {currentVal?.documentName && (
                                    <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                                      ✓ Archivo seleccionado: {currentVal.documentName}
                                    </span>
                                  )}
                                </div>
                              ) : p.tipo === 'si-no' ? (
                                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                                  <button
                                    type="button"
                                    onClick={() => setInvestigadorFormState(prev => ({ ...prev, [p.id]: 'SI' }))}
                                    style={{
                                      padding: '6px 16px',
                                      borderRadius: '20px',
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: currentVal === 'SI' ? '#10b981' : '#f8fafc',
                                      color: currentVal === 'SI' ? 'white' : '#475569',
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
                                    onClick={() => setInvestigadorFormState(prev => ({ ...prev, [p.id]: 'NO' }))}
                                    style={{
                                      padding: '6px 16px',
                                      borderRadius: '20px',
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: currentVal === 'NO' ? '#ef4444' : '#f8fafc',
                                      color: currentVal === 'NO' ? 'white' : '#475569',
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
                                      onClick={() => setInvestigadorFormState(prev => ({ ...prev, [p.id]: op }))}
                                      style={{
                                        padding: '6px 16px',
                                        borderRadius: '20px',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: currentVal === op ? '#3b82f6' : '#f8fafc',
                                        color: currentVal === op ? 'white' : '#475569',
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
                                    const arr = Array.isArray(currentVal) ? currentVal : [];
                                    const active = arr.includes(op);
                                    return (
                                      <button
                                        key={op}
                                        type="button"
                                        onClick={() => setInvestigadorFormState(prev => ({ ...prev, [p.id]: active ? arr.filter((o: string) => o !== op) : [...arr, op] }))}
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
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!currentVal}
                                    onChange={(e) => setInvestigadorFormState(prev => ({ ...prev, [p.id]: e.target.checked }))}
                                  />
                                  <span style={{ fontSize: '12.5px' }}>Conforme</span>
                                </label>
                              )
                            ) : (
                              // RENDERIZADO SOLO LECTURA
                              p.tipo === 'archivo' ? (
                                currentVal?.documentName ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', borderLeft: '3px solid #cbd5e1', fontSize: '12px' }}>
                                    <span>📎 {currentVal.documentName}</span>
                                    <button
                                      type="button"
                                      className="eval-btn eval-btn--outline"
                                      style={{ padding: '2px 8px', fontSize: '10.5px' }}
                                      onClick={() => {
                                        window.open(ceishService.getFileRawUrl(currentVal.documentPath), '_blank', 'noopener,noreferrer');
                                      }}
                                    >
                                      Ver
                                    </button>
                                  </div>
                                ) : (
                                  <p style={{ margin: 0, color: '#94a3b8', background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', borderLeft: '3px solid #cbd5e1', fontSize: '12px' }}>
                                    <em>Sin archivo adjunto</em>
                                  </p>
                                )
                              ) : p.tipo === 'seleccion-multiple' ? (
                                <p style={{ margin: 0, color: '#0f172a', background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', borderLeft: '3px solid #cbd5e1', fontSize: '13px' }}>
                                  {Array.isArray(currentVal) && currentVal.length > 0 ? currentVal.join(', ') : <em style={{ color: '#94a3b8' }}>Sin respuesta</em>}
                                </p>
                              ) : (
                                <p style={{ margin: 0, color: '#0f172a', background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', borderLeft: '3px solid #cbd5e1', whiteSpace: 'pre-wrap', fontSize: '13px' }}>
                                  {currentVal === 'SI' ? 'Sí' : currentVal === 'NO' ? 'No' : (typeof currentVal === 'boolean'
                                    ? (currentVal ? 'Sí (Conforme)' : 'No')
                                    : (currentVal ? String(currentVal) : <em style={{ color: '#94a3b8' }}>Sin respuesta</em>))
                                  }
                                </p>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="modal__footer" style={{ borderTop: '1px solid #cbd5e1', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                className="eval-btn eval-btn--outline" 
                onClick={() => {
                  if (isEditingInvestigadorAnexos && !window.confirm('Hay cambios sin guardar. ¿Desea cerrar de todas formas?')) return;
                  setIsEditingInvestigadorAnexos(false);
                  setShowInvestigadorModal(false);
                }}
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
