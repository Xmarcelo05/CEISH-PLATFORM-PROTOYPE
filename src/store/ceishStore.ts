import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  Documento, 
  AnexoTemplate, 
  RespuestaAnexo, 
  AsignacionCEISH,
  RiesgoTipo,
  DocumentoEstado,
  VersionArchivo,
  Pregunta,
  Seccion,
  TipoDocumento,
  AnexoAsignado,
  Notificacion,
  Escalamiento,
  Autor
} from '../shared/types/platform.types';

// ============================================================================
// AUXILIARES: GENERADOR DE UUID
// ============================================================================
const generateUUID = (): string => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ============================================================================
// SEED DATA: DOCUMENTOS Y ASIGNACIONES
// ============================================================================
const seedDocumentos = (): Documento[] => [
  {
    id: 'inv-seed-001',
    codigo: 'CEISH-2026-0001',
    tipoDocumentoId: 'tipo-investigacion',
    tema: 'Uso de pantallas y desarrollo lingüístico en infantes',
    descripcion: 'Análisis descriptivo del impacto del tiempo frente a pantallas en el vocabulario expresivo en niños de 2 a 4 años.',
    investigadorId: 'c0000000-0000-0000-0000-000000000001', // Juan Pérez
    autores: [
      { cedula: 'c0000000-0000-0000-0000-000000000001', nombre: 'Juan Pérez' },
      { cedula: '9999999999', nombre: 'Dra. María Andrade' }
    ],
    riesgoDeclarado: 'sin-riesgo',
    miembrosCeishDeclarados: [],
    estado: 'creada',
    versionesArchivo: [
      {
        id: 'ver-seed-001',
        documentName: 'Protocolo_Pantallas_V1.pdf',
        documentPath: 'mock/seed-proyecto-final-juan.pdf',
        comment: 'Documento inicial para revisión.',
        uploadedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
      }
    ],
    historialEstados: [
      {
        estado: 'creada',
        changedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        changedBy: 'Juan Pérez',
        comment: 'Proyecto registrado en la plataforma.'
      }
    ],
    createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'inv-seed-002',
    codigo: 'CEISH-2026-0002',
    tipoDocumentoId: 'tipo-investigacion',
    tema: 'Percepción docente sobre la educación inclusiva',
    descripcion: 'Estudio de encuesta para medir actitudes y barreras percibidas por docentes de secundaria ante la inclusión educativa.',
    investigadorId: 'c0000000-0000-0000-0000-000000000002', // María López
    autores: [
      { cedula: 'c0000000-0000-0000-0000-000000000002', nombre: 'María López' }
    ],
    riesgoDeclarado: 'sin-riesgo',
    miembrosCeishDeclarados: [],
    estado: 'estratificacion',
    versionesArchivo: [
      {
        id: 'ver-seed-002',
        documentName: 'Protocolo_Inclusion_Final.pdf',
        documentPath: 'mock/seed-proyecto-final-juan.pdf',
        comment: 'Se solicita revisión de exención ética.',
        uploadedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
      }
    ],
    historialEstados: [
      {
        estado: 'creada',
        changedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        changedBy: 'María López',
        comment: 'Registro del proyecto.'
      },
      {
        estado: 'estratificacion',
        changedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        changedBy: 'María López',
        comment: 'Revisión solicitada formalmente.'
      }
    ],
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  }
];

const seedAsignaciones = (): AsignacionCEISH[] => [
  {
    id: 'asig-seed-002',
    documentoId: 'inv-seed-002',
    evaluadorId: 'b0000000-0000-0000-0000-000000000001', // Profesor Demo
    seccionId: 'sec-estratificacion',
    assignedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    active: true
  }
];

// ============================================================================
// FUNCIONES AUXILIARES PURAS (Orquestación atómica del Estado)
// ============================================================================
interface SeccionInput {
  id?: string;
  nombre: string;
  orden: number;
  anexos: AnexoAsignado[];
}

const addAnexoTemplateToState = (
  state: CeishState,
  numero: number,
  nombre: string,
  rol: 'investigador' | 'evaluador',
  preguntasInput: Omit<Pregunta, 'id'>[],
  customId?: string
): Partial<CeishState> => {
  const id = customId || `anexo-${generateUUID()}`;
  const preguntas: Pregunta[] = preguntasInput.map((p, idx) => ({
    id: `preg-${generateUUID()}`,
    texto: p.texto,
    tipo: p.tipo,
    descripcionContexto: p.descripcionContexto,
    orden: p.orden ?? idx + 1
  }));

  const nuevoTemplate: AnexoTemplate = { id, numero, nombre, rol, preguntas };
  return {
    anexosTemplates: [...state.anexosTemplates, nuevoTemplate]
  };
};

const addTipoDocumentoToState = (
  state: CeishState,
  nombre: string,
  seccionesInput: SeccionInput[],
  customId?: string
): Partial<CeishState> => {
  const id = customId || `tipo-doc-${generateUUID()}`;
  const secciones: Seccion[] = seccionesInput.map((sec, idx) => ({
    id: sec.id || `sec-${generateUUID()}`,
    nombre: sec.nombre,
    orden: sec.orden ?? idx + 1,
    anexos: sec.anexos
  }));

  const nuevoTipo: TipoDocumento = { id, nombre, secciones };
  return {
    tiposDocumento: [...state.tiposDocumento, nuevoTipo]
  };
};

// ============================================================================
// INTERFAZ DE ESTADO Y ACCIONES CEISH
// ============================================================================
interface CeishState {
  anexosTemplates: AnexoTemplate[];
  tiposDocumento: TipoDocumento[];
  documentos: Documento[];
  respuestasAnexos: RespuestaAnexo[];
  asignaciones: AsignacionCEISH[];
  escalamientos: Escalamiento[];
  notificaciones: Notificacion[];

  // CRUD Configuración Anexos
  crearAnexoTemplate: (
    numero: number,
    nombre: string,
    rol: 'investigador' | 'evaluador',
    preguntas: Omit<Pregunta, 'id'>[],
    customId?: string
  ) => void;
  editarAnexoTemplate: (
    id: string,
    numero: number,
    nombre: string,
    rol: 'investigador' | 'evaluador',
    preguntas: (Omit<Pregunta, 'id'> & { id?: string })[]
  ) => void;
  eliminarAnexoTemplate: (id: string) => void;

  // CRUD Configuración Tipos de Documento
  crearTipoDocumento: (
    nombre: string,
    secciones: SeccionInput[],
    customId?: string
  ) => void;
  editarTipoDocumento: (
    id: string,
    nombre: string,
    secciones: SeccionInput[]
  ) => void;
  eliminarTipoDocumento: (id: string) => void;

  // Acciones Operativas Trámite
  crearDocumento: (
    tipoDocumentoId: string,
    tema: string,
    descripcion: string,
    autores: Autor[],
    riesgoDeclarado: RiesgoTipo,
    miembrosCeishDeclarados: string[],
    investigadorId: string,
    investigadorNombre: string,
    documentName: string,
    documentPath: string,
    customId?: string,
    customVersionId?: string
  ) => void;

  editarDocumento: (
    id: string,
    campos: Partial<Pick<Documento, 'tema' | 'descripcion' | 'riesgoDeclarado' | 'riesgoConfirmado' | 'estado'>>,
    nuevoEvaluadorId?: string
  ) => void;

  solicitarRevision: (documentoId: string, solicitanteNombre: string) => void;

  guardarRespuestaAnexo: (
    emision: Omit<RespuestaAnexo, 'id' | 'emitidoAt' | 'resultado' | 'snapshotPreguntas'>
  ) => void;

  emitirAnexo: (
    emision: Omit<RespuestaAnexo, 'id' | 'emitidoAt' | 'resultado' | 'snapshotPreguntas'>,
    resultado: RespuestaAnexo['resultado'],
    nuevoEstado: DocumentoEstado,
    cambioComentario?: string,
    nuevoRiesgoConfirmado?: RiesgoTipo
  ) => void;

  darseDeBajaRevisor: (
    documentoId: string,
    evaluadorId: string,
    evaluadorNombre: string,
    comentarioConflicto: string
  ) => void;

  subirCorreccion: (
    documentoId: string,
    documentName: string,
    documentPath: string,
    investigadorNombre: string
  ) => void;

  crearNotificacion: (destinatarioId: string, mensaje: string, tipo?: Notificacion['tipo']) => void;
  marcarNotificacionLeida: (id: string) => void;

  crearEscalamiento: (
    documentoId: string,
    seccionId: string,
    anexoTemplateId: string,
    comentarioEvaluador: string,
    respuestaAnexoId: string
  ) => void;
  resolverEscalamiento: (id: string, edicionAdmin: string) => void;

  resetearDatos: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================
export const useCeishStore = create<CeishState>()(
  persist(
    (set) => ({
      anexosTemplates: [],
      tiposDocumento: [],
      documentos: [],
      respuestasAnexos: [],
      asignaciones: [],
      escalamientos: [],
      notificaciones: [],

      // CRUD Anexos
      crearAnexoTemplate: (numero, nombre, rol, preguntas, customId) => set((state) => ({
        ...state,
        ...addAnexoTemplateToState(state, numero, nombre, rol, preguntas, customId)
      })),

      editarAnexoTemplate: (id, numero, nombre, rol, preguntasInput) => set((state) => {
        const idx = state.anexosTemplates.findIndex(t => t.id === id);
        if (idx === -1) return {};

        const oldTemplate = state.anexosTemplates[idx];
        const nuevasPreguntas: Pregunta[] = preguntasInput.map((p, pIdx) => ({
          id: p.id || `preg-${generateUUID()}`,
          texto: p.texto,
          tipo: p.tipo,
          descripcionContexto: p.descripcionContexto,
          orden: p.orden ?? pIdx + 1
        }));

        const nuevoTemplate: AnexoTemplate = { ...oldTemplate, numero, nombre, rol, preguntas: nuevasPreguntas };
        const nuevosTemplates = [...state.anexosTemplates];
        nuevosTemplates[idx] = nuevoTemplate;

        // Reglas de Congelamiento v3 (Sección 7):
        // Identificar documentos activos (excluyendo cerrados: aprobada o anulada)
        const docsActivos = state.documentos.filter(d => d.estado !== 'aprobada' && d.estado !== 'anulada');
        const docsActivosIds = docsActivos.map(d => d.id);

        let nuevasRespuestas = [...state.respuestasAnexos];
        let nuevasNotificaciones = [...state.notificaciones];

        nuevasRespuestas = nuevasRespuestas.map(resp => {
          if (resp.anexoTemplateId === id && docsActivosIds.includes(resp.documentoId)) {
            // Filtrar respuestas a preguntas que fueron eliminadas o modificadas
            const valoresFiltrados = resp.valores.filter(val => {
              const nuevaPreg = nuevasPreguntas.find(p => p.id === val.campoId);
              const viejaPreg = oldTemplate.preguntas.find(p => p.id === val.campoId);
              if (!nuevaPreg) return false; // Pregunta borrada
              if (viejaPreg && viejaPreg.texto !== nuevaPreg.texto) return false; // Pregunta con texto editado
              return true;
            });

            const huboCambios = valoresFiltrados.length !== resp.valores.length;
            if (huboCambios) {
              const doc = docsActivos.find(d => d.id === resp.documentoId);
              nuevasNotificaciones.push({
                id: generateUUID(),
                tipo: 'automatica',
                destinatarioId: resp.emitidoPorId,
                mensaje: `El Administrador modificó preguntas del Anexo ${numero} (${nombre}) en el proyecto ${doc?.codigo}. Las respuestas afectadas han sido liquidadas del registro para auditoría.`,
                leida: false,
                createdAt: new Date().toISOString()
              });
            }

            return {
              ...resp,
              valores: valoresFiltrados
            };
          }
          return resp;
        });

        return {
          anexosTemplates: nuevosTemplates,
          respuestasAnexos: nuevasRespuestas,
          notificaciones: nuevasNotificaciones
        };
      }),

      eliminarAnexoTemplate: (id) => set((state) => {
        const nuevosTemplates = state.anexosTemplates.filter(t => t.id !== id);
        
        // Remover de secciones de TipoDocumento
        const nuevosTipos = state.tiposDocumento.map(tipo => ({
          ...tipo,
          secciones: tipo.secciones.map(sec => ({
            ...sec,
            anexos: sec.anexos.filter(a => a.anexoTemplateId !== id)
          }))
        }));

        // Limpiar respuestas asociadas en documentos en proceso
        const docsActivosIds = state.documentos
          .filter(d => d.estado !== 'aprobada' && d.estado !== 'anulada')
          .map(d => d.id);

        const nuevasRespuestas = state.respuestasAnexos.filter(
          resp => !(resp.anexoTemplateId === id && docsActivosIds.includes(resp.documentoId))
        );

        return {
          anexosTemplates: nuevosTemplates,
          tiposDocumento: nuevosTipos,
          respuestasAnexos: nuevasRespuestas
        };
      }),

      // CRUD Tipos de Documento
      crearTipoDocumento: (nombre, secciones, customId) => set((state) => ({
        ...state,
        ...addTipoDocumentoToState(state, nombre, secciones, customId)
      })),

      editarTipoDocumento: (id, nombre, seccionesInput) => set((state) => {
        const idx = state.tiposDocumento.findIndex(t => t.id === id);
        if (idx === -1) return {};

        const secciones: Seccion[] = seccionesInput.map((sec, sIdx) => ({
          id: sec.id || `sec-${generateUUID()}`,
          nombre: sec.nombre,
          orden: sec.orden ?? sIdx + 1,
          anexos: sec.anexos
        }));

        const nuevosTipos = [...state.tiposDocumento];
        nuevosTipos[idx] = { id, nombre, secciones };

        return {
          tiposDocumento: nuevosTipos
        };
      }),

      eliminarTipoDocumento: (id) => set((state) => ({
        tiposDocumento: state.tiposDocumento.filter(t => t.id !== id)
      })),

      // Acciones Operativas Trámite
      crearDocumento: (
        tipoDocumentoId,
        tema,
        descripcion,
        autores,
        riesgoDeclarado,
        miembrosCeishDeclarados,
        investigadorId,
        investigadorNombre,
        documentName,
        documentPath,
        customId,
        customVersionId
      ) => set((state) => {
        const id = customId || generateUUID();
        const correlativo = String(state.documentos.length + 1).padStart(4, '0');
        const codigo = `CEISH-2026-${correlativo}`;
        const timestamp = new Date().toISOString();

        const nuevaVersion: VersionArchivo = {
          id: customVersionId || generateUUID(),
          documentName,
          documentPath,
          comment: 'Documento inicial cargado al registrar el trámite.',
          uploadedAt: timestamp
        };

        const tipoDoc = state.tiposDocumento.find(t => t.id === tipoDocumentoId);
        const seccionAsignada = tipoDoc?.secciones[1]; // Estratificación

        const evaluadoresSistema = [
          { id: 'b0000000-0000-0000-0000-000000000001', name: 'Profesor Demo', cedula: 'b0000000-0000-0000-0000-000000000001' },
          { id: 'b0000000-0000-0000-0000-000000000002', name: 'Evaluador Alterno CEISH', cedula: 'b0000000-0000-0000-0000-000000000002' },
          { id: 'b0000000-0000-0000-0000-000000000003', name: 'Dr. Roberto Anchundia', cedula: 'b0000000-0000-0000-0000-000000000003' }
        ];

        const exclusionesCopia = [...miembrosCeishDeclarados];
        autores.forEach(autor => {
          const evalCoincidente = evaluadoresSistema.find(ev => ev.cedula === autor.cedula);
          if (evalCoincidente && !exclusionesCopia.includes(evalCoincidente.id)) {
            exclusionesCopia.push(evalCoincidente.id);
          }
        });

        const evaluadoresDisponibles = evaluadoresSistema.filter(
          ev => !exclusionesCopia.includes(ev.id)
        );

        let asignacionesActualizadas = [...state.asignaciones];
        let estadoInicial: DocumentoEstado = 'creada';
        let historialEstados = [
          {
            estado: 'creada' as DocumentoEstado,
            changedAt: timestamp,
            changedBy: investigadorNombre,
            comment: 'Trámite registrado e iniciado.'
          }
        ];

        if (seccionAsignada && evaluadoresDisponibles.length > 0) {
          const randomIdx = Math.floor(Math.random() * evaluadoresDisponibles.length);
          const evaluadorSeleccionado = evaluadoresDisponibles[randomIdx];

          const nuevaAsignacion: AsignacionCEISH = {
            id: generateUUID(),
            documentoId: id,
            evaluadorId: evaluadorSeleccionado.id,
            seccionId: seccionAsignada.id,
            assignedAt: timestamp,
            active: true
          };

          asignacionesActualizadas.push(nuevaAsignacion);
          estadoInicial = 'estratificacion';
          historialEstados.push({
            estado: 'estratificacion' as DocumentoEstado,
            changedAt: timestamp,
            changedBy: 'Sistema CEISH',
            comment: 'Asignación ciega automatizada tras completar Etapa 1.'
          });
        }

        const nuevoDoc: Documento = {
          id,
          codigo,
          tipoDocumentoId,
          tema,
          descripcion,
          investigadorId,
          autores,
          riesgoDeclarado,
          miembrosCeishDeclarados: exclusionesCopia,
          estado: estadoInicial,
          versionesArchivo: [nuevaVersion],
          historialEstados,
          createdAt: timestamp
        };

        return {
          documentos: [...state.documentos, nuevoDoc],
          asignaciones: asignacionesActualizadas
        };
      }),

      editarDocumento: (id, campos, nuevoEvaluadorId) => set((state) => {
        const docIdx = state.documentos.findIndex(d => d.id === id);
        if (docIdx === -1) return {};

        const doc = state.documentos[docIdx];
        const timestamp = new Date().toISOString();
        const estadoCambiado = campos.estado && campos.estado !== doc.estado;

        const docActualizado: Documento = {
          ...doc,
          ...campos,
          historialEstados: estadoCambiado ? [
            ...doc.historialEstados,
            {
              estado: campos.estado!,
              changedAt: timestamp,
              changedBy: 'Administrador',
              comment: `Estado modificado manualmente por el Administrador a: ${campos.estado}.`
            }
          ] : doc.historialEstados
        };

        const nuevosDocs = [...state.documentos];
        nuevosDocs[docIdx] = docActualizado;

        let asignacionesActualizadas = [...state.asignaciones];

        if (nuevoEvaluadorId) {
          // Deactivar asignaciones activas previas
          asignacionesActualizadas = asignacionesActualizadas.map(asig => {
            if (asig.documentoId === id && asig.active) {
              return {
                ...asig,
                active: false,
                bajaMotivo: 'Reasignado por el Administrador.'
              };
            }
            return asig;
          });

          // Determinar la sección correcta según el estado (actualizado)
          const estadoActual = campos.estado || doc.estado;
          let seccionId = 'sec-estratificacion'; // por defecto para 'estratificacion' o 'creada'
          if (estadoActual === 'revision-tecnica') {
            seccionId = 'sec-evaluacion';
          }

          const nuevaAsignacion: AsignacionCEISH = {
            id: generateUUID(),
            documentoId: id,
            evaluadorId: nuevoEvaluadorId,
            seccionId: seccionId,
            assignedAt: timestamp,
            active: true
          };

          asignacionesActualizadas.push(nuevaAsignacion);

          // Si el documento estaba en 'creada', al asignar revisor pasa a 'estratificacion'
          if (docActualizado.estado === 'creada') {
            docActualizado.estado = 'estratificacion';
            docActualizado.historialEstados.push({
              estado: 'estratificacion',
              changedAt: timestamp,
              changedBy: 'Administrador',
              comment: 'Asignación manual de revisor. Proyecto pasa a etapa de Estratificación.'
            });
          }
        }

        return {
          documentos: nuevosDocs,
          asignaciones: asignacionesActualizadas
        };
      }),

      solicitarRevision: (documentoId, solicitanteNombre) => set((state) => {
        const timestamp = new Date().toISOString();
        const docIdx = state.documentos.findIndex(d => d.id === documentoId);
        if (docIdx === -1) return {};

        const doc = state.documentos[docIdx];
        const tipoDoc = state.tiposDocumento.find(t => t.id === doc.tipoDocumentoId);
        if (!tipoDoc) return {};

        // Seccion activa dinámica para la asignación (usualmente la segunda sección tras creación)
        const seccionAsignada = tipoDoc.secciones[1];
        if (!seccionAsignada) return {};

        // Detección automática de conflictos de interés
        // Se cruzan las cédulas de los autores contra los evaluadores registrados
        const evaluadoresSistema = [
          { id: 'b0000000-0000-0000-0000-000000000001', name: 'Profesor Demo', cedula: 'b0000000-0000-0000-0000-000000000001' },
          { id: 'b0000000-0000-0000-0000-000000000002', name: 'Evaluador Alterno CEISH', cedula: 'b0000000-0000-0000-0000-000000000002' },
          { id: 'b0000000-0000-0000-0000-000000000003', name: 'Dr. Roberto Anchundia', cedula: 'b0000000-0000-0000-0000-000000000003' }
        ];

        // Cruzar y recopilar exclusiones automáticas por cédula
        const exclusionesCopia = [...doc.miembrosCeishDeclarados];
        doc.autores.forEach(autor => {
          const evalCoincidente = evaluadoresSistema.find(ev => ev.cedula === autor.cedula);
          if (evalCoincidente && !exclusionesCopia.includes(evalCoincidente.id)) {
            exclusionesCopia.push(evalCoincidente.id);
          }
        });

        const evaluadoresDisponibles = evaluadoresSistema.filter(
          ev => !exclusionesCopia.includes(ev.id)
        );

        if (evaluadoresDisponibles.length === 0) {
          throw new Error('No existen evaluadores disponibles sin conflicto de interés en la plataforma para este proyecto.');
        }

        const randomIdx = Math.floor(Math.random() * evaluadoresDisponibles.length);
        const evaluadorSeleccionado = evaluadoresDisponibles[randomIdx];

        const nuevaAsignacion: AsignacionCEISH = {
          id: generateUUID(),
          documentoId,
          evaluadorId: evaluadorSeleccionado.id,
          seccionId: seccionAsignada.id,
          assignedAt: timestamp,
          active: true
        };

        const docActualizado: Documento = {
          ...doc,
          estado: 'estratificacion',
          miembrosCeishDeclarados: exclusionesCopia,
          historialEstados: [
            ...doc.historialEstados,
            {
              estado: 'estratificacion',
              changedAt: timestamp,
              changedBy: solicitanteNombre,
              comment: 'Solicitud enviada a revisión. Revisor asignado automáticamente por asignación ciega.'
            }
          ]
        };

        const nuevosDocs = [...state.documentos];
        nuevosDocs[docIdx] = docActualizado;

        return {
          documentos: nuevosDocs,
          asignaciones: [...state.asignaciones, nuevaAsignacion]
        };
      }),

      guardarRespuestaAnexo: (emision) => set((state) => {
        const index = state.respuestasAnexos.findIndex(
          re => re.documentoId === emision.documentoId && re.anexoTemplateId === emision.anexoTemplateId && re.versionArchivoId === emision.versionArchivoId
        );

        const template = state.anexosTemplates.find(t => t.id === emision.anexoTemplateId);
        if (!template) return {};

        const timestamp = new Date().toISOString();
        const nuevaResp: RespuestaAnexo = {
          ...emision,
          id: index !== -1 ? state.respuestasAnexos[index].id : generateUUID(),
          emitidoAt: timestamp,
          resultado: 'coincide', // Valor por defecto para borrador
          snapshotPreguntas: template.preguntas
        };

        const nuevasRespuestas = [...state.respuestasAnexos];
        if (index !== -1) {
          nuevasRespuestas[index] = nuevaResp;
        } else {
          nuevasRespuestas.push(nuevaResp);
        }

        return {
          respuestasAnexos: nuevasRespuestas
        };
      }),

      emitirAnexo: (emision, resultado, nuevoEstado, cambioComentario, nuevoRiesgoConfirmado) => set((state) => {
        const timestamp = new Date().toISOString();
        const emisionId = generateUUID();

        const template = state.anexosTemplates.find(t => t.id === emision.anexoTemplateId);
        if (!template) return {};

        // 1. Registrar emisión oficial con snapshot congelado de preguntas
        const nuevaResp: RespuestaAnexo = {
          ...emision,
          id: emisionId,
          emitidoAt: timestamp,
          resultado,
          snapshotPreguntas: template.preguntas
        };

        // Limpiar algún borrador previo para esta versión/anexo/proyecto
        const filtradasResp = state.respuestasAnexos.filter(
          re => !(re.documentoId === emision.documentoId && re.anexoTemplateId === emision.anexoTemplateId && re.versionArchivoId === emision.versionArchivoId)
        );

        // 2. Actualizar estado y cronómetro del documento
        const docIdx = state.documentos.findIndex(d => d.id === emision.documentoId);
        if (docIdx === -1) return {};

        const doc = state.documentos[docIdx];
        const cronometroActualizado = nuevoEstado === 'aprobada'
          ? { fechaAprobacion: timestamp, diasEjecucion: 365 }
          : doc.cronometro;

        // ====================================================================
        // COMENTARIO DE CONTROL DE ARQUITECTURA (LIMITACIÓN CONSCIENTE DEL PROTOTIPO):
        // Los disparadores automáticos a continuación están mapeados de forma estática
        // por 'anexoTemplateId' específico (anexo-27, anexo-11, etc.). Si el
        // administrador configura un nuevo tipo de documento con diferentes anexos,
        // estas transiciones específicas de negocio deberán programarse a mano en
        // esta sección de código, ya que esta fase no incluye un motor de reglas.
        // ====================================================================
        const invActualizada: Documento = {
          ...doc,
          estado: nuevoEstado,
          riesgoConfirmado: emision.anexoTemplateId === 'anexo-27' && resultado === 'coincide' ? doc.riesgoDeclarado : (nuevoRiesgoConfirmado || doc.riesgoConfirmado),
          cronometro: cronometroActualizado,
          historialEstados: [
            ...doc.historialEstados,
            {
              estado: nuevoEstado,
              changedAt: timestamp,
              changedBy: emision.emitidoPorNombre,
              comment: cambioComentario || `Emisión oficial del Anexo Template (${emision.anexoTemplateId})`
            }
          ]
        };

        const nuevosDocs = [...state.documentos];
        nuevosDocs[docIdx] = invActualizada;

        // 3. Desactivar asignaciones si el trámite finaliza (Aprobada / Anulada)
        let nuevasAsignaciones = state.asignaciones;
        if (nuevoEstado === 'aprobada' || nuevoEstado === 'anulada') {
          nuevasAsignaciones = state.asignaciones.map(asig =>
            asig.documentoId === emision.documentoId ? { ...asig, active: false } : asig
          );
        }

        return {
          respuestasAnexos: [...filtradasResp, nuevaResp],
          documentos: nuevosDocs,
          asignaciones: nuevasAsignaciones
        };
      }),

      darseDeBajaRevisor: (documentoId, evaluadorId, evaluadorNombre, comentarioConflicto) => set((state) => {
        const timestamp = new Date().toISOString();
        const anexo23Id = generateUUID();

        const template = state.anexosTemplates.find(t => t.id === 'anexo-23');
        if (!template) return {};

        const docIdx = state.documentos.findIndex(d => d.id === documentoId);
        if (docIdx === -1) return {};
        const doc = state.documentos[docIdx];

        // 1. Emitir la baja (Anexo 23)
        const emisionConflicto: RespuestaAnexo = {
          id: anexo23Id,
          anexoTemplateId: 'anexo-23',
          documentoId,
          seccionId: 'sec-estratificacion',
          versionArchivoId: doc.versionesArchivo.slice(-1)[0]?.id || '',
          emitidoPorId: evaluadorId,
          emitidoPorNombre: evaluadorNombre,
          emitidoAt: timestamp,
          resultado: 'conflicto-interes',
          valores: [
            { campoId: 'a23_c1', valor: comentarioConflicto },
            { campoId: 'a23_c2', valor: true }
          ],
          comentariosAnotados: [],
          snapshotPreguntas: template.preguntas
        };

        // 2. Cancelar la asignación actual
        const nuevasAsignaciones = state.asignaciones.map((asig) => {
          if (asig.documentoId === documentoId && asig.evaluadorId === evaluadorId && asig.active) {
            return {
              ...asig,
              active: false,
              bajaMotivo: 'Inhibición declarada (Anexo 23).',
              bajaAnexoId: anexo23Id
            };
          }
          return asig;
        });

        // 3. Excluir permanentemente al evaluador
        const exclusionesActualizadas = Array.from(new Set([...doc.miembrosCeishDeclarados, evaluadorId]));

        // 4. Buscar reasignación ciega automática
        const evaluadoresSistema = [
          { id: 'b0000000-0000-0000-0000-000000000001', name: 'Profesor Demo' },
          { id: 'b0000000-0000-0000-0000-000000000002', name: 'Evaluador Alterno CEISH' },
          { id: 'b0000000-0000-0000-0000-000000000003', name: 'Dr. Roberto Anchundia' }
        ];

        const evaluadoresDisponibles = evaluadoresSistema.filter(
          ev => ev.id !== evaluadorId && !exclusionesActualizadas.includes(ev.id)
        );

        let asignacionFinal = nuevasAsignaciones;
        let comentarioHistorial = `El revisor se inhibió del proceso por conflicto de interés (Anexo 23).`;

        if (evaluadoresDisponibles.length > 0) {
          const randomIdx = Math.floor(Math.random() * evaluadoresDisponibles.length);
          const nuevoEvaluador = evaluadoresDisponibles[randomIdx];

          const nuevaAsignacion: AsignacionCEISH = {
            id: generateUUID(),
            documentoId,
            evaluadorId: nuevoEvaluador.id,
            seccionId: 'sec-estratificacion',
            assignedAt: timestamp,
            active: true
          };

          asignacionFinal.push(nuevaAsignacion);
          comentarioHistorial += ` Reasignado automáticamente al revisor: ${nuevoEvaluador.name}.`;
        } else {
          comentarioHistorial += ` No existen más revisores disponibles en la plataforma.`;
        }

        const docActualizado: Documento = {
          ...doc,
          estado: 'estratificacion',
          miembrosCeishDeclarados: exclusionesActualizadas,
          historialEstados: [
            ...doc.historialEstados,
            {
              estado: 'estratificacion',
              changedAt: timestamp,
              changedBy: evaluadorNombre,
              comment: comentarioHistorial
            }
          ]
        };

        const nuevosDocs = [...state.documentos];
        nuevosDocs[docIdx] = docActualizado;

        return {
          respuestasAnexos: [...state.respuestasAnexos, emisionConflicto],
          asignaciones: asignacionFinal,
          documentos: nuevosDocs
        };
      }),

      subirCorreccion: (documentoId, documentName, documentPath, investigadorNombre) => set((state) => {
        const timestamp = new Date().toISOString();
        const docIdx = state.documentos.findIndex(d => d.id === documentoId);
        if (docIdx === -1) return {};

        const doc = state.documentos[docIdx];
        
        const nuevaVersion: VersionArchivo = {
          id: generateUUID(),
          documentName,
          documentPath,
          comment: 'Nueva versión con correcciones cargadas.',
          uploadedAt: timestamp
        };

        // Mantener las asignaciones previas pero reactivarlas en caso de que hubiesen quedado inactivas
        const asignacionesActualizadas = state.asignaciones.map(asig => {
          if (asig.documentoId === documentoId && !asig.active && !asig.bajaMotivo) {
            return { ...asig, active: true };
          }
          return asig;
        });

        const docActualizado: Documento = {
          ...doc,
          estado: 'revision-tecnica',
          versionesArchivo: [...doc.versionesArchivo, nuevaVersion],
          historialEstados: [
            ...doc.historialEstados,
            {
              estado: 'revision-tecnica',
              changedAt: timestamp,
              changedBy: investigadorNombre,
              comment: 'Investigador subió una nueva versión del archivo para revisión técnica.'
            }
          ]
        };

        const nuevosDocs = [...state.documentos];
        nuevosDocs[docIdx] = docActualizado;

        return {
          documentos: nuevosDocs,
          asignaciones: asignacionesActualizadas
        };
      }),

      // Notificaciones
      crearNotificacion: (destinatarioId, mensaje, tipo = 'automatica') => set((state) => ({
        notificaciones: [
          ...state.notificaciones,
          {
            id: generateUUID(),
            tipo,
            destinatarioId,
            mensaje,
            leida: false,
            createdAt: new Date().toISOString()
          }
        ]
      })),

      marcarNotificacionLeida: (id) => set((state) => ({
        notificaciones: state.notificaciones.map(n => n.id === id ? { ...n, leida: true } : n)
      })),

      // Escalamientos
      crearEscalamiento: (documentoId, seccionId, anexoTemplateId, comentarioEvaluador, respuestaAnexoId) => set((state) => ({
        escalamientos: [
          ...state.escalamientos,
          {
            id: generateUUID(),
            respuestaAnexoId,
            documentoId,
            seccionId,
            anexoTemplateId,
            comentarioEvaluador,
            estado: 'pendiente',
            notificado: false,
            createdAt: new Date().toISOString()
          }
        ]
      })),

      resolverEscalamiento: (id, edicionAdmin) => set((state) => {
        const idx = state.escalamientos.findIndex(e => e.id === id);
        if (idx === -1) return {};

        const esc = state.escalamientos[idx];
        const nuevosEsc = [...state.escalamientos];
        nuevosEsc[idx] = { ...esc, estado: 'resuelto', edicionAdmin, notificado: true };

        return {
          escalamientos: nuevosEsc
        };
      }),

      // Orquestación limpia del Seed mediante un único set() final
      resetearDatos: () => set((state) => {
        let tempState: CeishState = {
          ...state,
          anexosTemplates: [],
          tiposDocumento: [],
          documentos: seedDocumentos(),
          respuestasAnexos: [],
          asignaciones: seedAsignaciones(),
          escalamientos: [],
          notificaciones: []
        };

        // 1. Acumular Anexos 1 a 9 del Investigador
        tempState = { ...tempState, ...addAnexoTemplateToState(tempState, 1, 'Solicitud de Revisión Técnica', 'investigador', [
          { texto: 'Título descriptivo del proyecto de investigación', tipo: 'texto-libre', orden: 1 },
          { texto: 'Breve justificación e hipótesis de trabajo', tipo: 'texto-libre', orden: 2 }
        ], 'anexo-1') } as CeishState;

        for (let i = 2; i <= 9; i++) {
          tempState = { ...tempState, ...addAnexoTemplateToState(tempState, i, `Anexo ${i} Formulario de Ficha Ética`, 'investigador', [
            { texto: `Pregunta declaratoria de cumplimiento Anexo ${i}`, tipo: 'checklist', orden: 1 }
          ], `anexo-${i}`) } as CeishState;
        }

        // 2. Acumular Anexos del Evaluador (Estratificación y Evaluación)
        tempState = { ...tempState, ...addAnexoTemplateToState(tempState, 27, 'Formato para Estratificación de Riesgos', 'evaluador', [
          { texto: '1. ¿La investigación involucra procedimientos que puedan causar daño físico o psicológico directo al sujeto?', tipo: 'checklist', orden: 1 },
          { texto: '2. ¿Se recolectan datos personales sensibles o información privada de carácter confidencial?', tipo: 'checklist', orden: 2 },
          { texto: '3. ¿Se utilizan muestras biológicas humanas (sangre, tejidos, fluidos)?', tipo: 'checklist', orden: 3 },
          { texto: '4. ¿Involucra poblaciones vulnerables (niños, personas con discapacidad, etc.)?', tipo: 'checklist', orden: 4 },
          { texto: 'Justificación / Criterio final del revisor', tipo: 'texto-libre', orden: 5 }
        ], 'anexo-27') } as CeishState;

        tempState = { ...tempState, ...addAnexoTemplateToState(tempState, 11, 'Formato de Carta de Exención (Sin Riesgo)', 'evaluador', [
          { texto: 'Justificación técnica del cumplimiento de criterios de exención ética', tipo: 'texto-libre', orden: 1 },
          { texto: 'Declaración formal de exención de revisión por el comité CEISH', tipo: 'checklist', orden: 2 }
        ], 'anexo-11') } as CeishState;

        tempState = { ...tempState, ...addAnexoTemplateToState(tempState, 23, 'Declaración de Conflicto de Intereses', 'evaluador', [
          { texto: 'Describa detalladamente la causa de su conflicto de interés con el proyecto o sus autores', tipo: 'texto-libre', orden: 1 },
          { texto: 'Declaración juramentada de inhibición en el proceso de evaluación', tipo: 'checklist', orden: 2 }
        ], 'anexo-23') } as CeishState;

        tempState = { ...tempState, ...addAnexoTemplateToState(tempState, 12, 'Check List de Evaluación de Proyecto', 'evaluador', [
          { texto: 'A. Título de la investigación descriptivo y delimitado', tipo: 'checklist', orden: 1 },
          { texto: 'B. Justificación teórica y empírica del problema de investigación', tipo: 'checklist', orden: 2 },
          { texto: 'C. Objetivos específicos coherentes con el objetivo general', tipo: 'checklist', orden: 3 },
          { texto: 'D. Diseño metodológico adecuado y detallado', tipo: 'checklist', orden: 4 },
          { texto: 'E. Consideraciones éticas aplicables debidamente fundamentadas', tipo: 'checklist', orden: 5 },
          { texto: 'F. Observaciones generales detalladas', tipo: 'texto-libre', orden: 6 }
        ], 'anexo-12') } as CeishState;

        tempState = { ...tempState, ...addAnexoTemplateToState(tempState, 13, 'Formato para emisión de resoluciones de aprobación', 'evaluador', [
          { texto: 'Declaración formal de Aprobación Ética y Metodológica', tipo: 'checklist', orden: 1 },
          { texto: 'Términos y condiciones de la aprobación del proyecto', tipo: 'texto-libre', orden: 2 }
        ], 'anexo-13') } as CeishState;

        tempState = { ...tempState, ...addAnexoTemplateToState(tempState, 26, 'Resolución de suspensión o revocatoria', 'evaluador', [
          { texto: 'Motivos de la suspensión/revocatoria (vencimiento de plazos, faltas éticas, etc.)', tipo: 'texto-libre', orden: 1 },
          { texto: 'Declaración formal de suspensión de la validez del certificado aprobatorio', tipo: 'checklist', orden: 2 }
        ], 'anexo-26') } as CeishState;

        // 3. Crear el Tipo de Documento "Investigación" asociando las plantillas dinámicas
        tempState = { ...tempState, ...addTipoDocumentoToState(tempState, 'Investigación', [
          {
            id: 'sec-creacion',
            nombre: 'Etapa 1: Creación de Investigación',
            orden: 1,
            anexos: [
              { anexoTemplateId: 'anexo-1', obligatorio: true },
              { anexoTemplateId: 'anexo-2', obligatorio: true },
              { anexoTemplateId: 'anexo-3', obligatorio: true },
              { anexoTemplateId: 'anexo-4', obligatorio: true },
              { anexoTemplateId: 'anexo-5', obligatorio: true },
              { anexoTemplateId: 'anexo-6', obligatorio: true },
              { anexoTemplateId: 'anexo-7', obligatorio: true },
              { anexoTemplateId: 'anexo-8', obligatorio: true },
              { anexoTemplateId: 'anexo-9', obligatorio: true }
            ]
          },
          {
            id: 'sec-estratificacion',
            nombre: 'Etapa 2: Estratificación',
            orden: 2,
            anexos: [
              { anexoTemplateId: 'anexo-27', obligatorio: true },
              { anexoTemplateId: 'anexo-11', obligatorio: true },
              { anexoTemplateId: 'anexo-23', obligatorio: false }
            ]
          },
          {
            id: 'sec-evaluacion',
            nombre: 'Etapa 3: Evaluación',
            orden: 3,
            anexos: [
              { anexoTemplateId: 'anexo-12', obligatorio: true },
              { anexoTemplateId: 'anexo-13', obligatorio: true },
              { anexoTemplateId: 'anexo-26', obligatorio: false }
            ]
          }
        ], 'tipo-investigacion') } as CeishState;

        return tempState;
      })
    }),
    {
      name: 'ceish-prototype-storage',
    }
  )
);
