import { create } from 'zustand';
import { ceishService } from '../services/ceishService';
import type {
  Documento,
  AnexoTemplate,
  RespuestaAnexo,
  AsignacionCEISH,
  RiesgoTipo,
  DocumentoEstado,
  Pregunta,
  TipoDocumento,
  AnexoAsignado,
  Notificacion,
  Escalamiento,
  Autor
} from '../shared/types/platform.types';

// ============================================================================
// FUNCIONES AUXILIARES PURAS (Orquestación atómica del Estado)
// ============================================================================
interface SeccionInput {
  id?: string;
  nombre: string;
  orden: number;
  anexos: AnexoAsignado[];
}

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

  // Carga inicial de configuración (servidor)
  cargarConfiguracion: () => Promise<void>;

  // CRUD Configuración Anexos (persistido en PostgreSQL vía /api/ceish/anexo-templates)
  crearAnexoTemplate: (
    numero: number,
    nombre: string,
    rol: 'investigador' | 'evaluador',
    preguntas: Omit<Pregunta, 'id'>[],
    wordTemplateName?: string,
    wordTemplateObjectKey?: string
  ) => Promise<void>;
  editarAnexoTemplate: (
    id: string,
    numero: number,
    nombre: string,
    rol: 'investigador' | 'evaluador',
    preguntas: (Omit<Pregunta, 'id'> & { id?: string })[],
    wordTemplateName?: string,
    wordTemplateObjectKey?: string
  ) => Promise<void>;
  eliminarAnexoTemplate: (id: string) => Promise<void>;

  // CRUD Configuración Tipos de Documento (persistido vía /api/ceish/tipos-documento)
  crearTipoDocumento: (nombre: string, secciones: SeccionInput[]) => Promise<void>;
  editarTipoDocumento: (id: string, nombre: string, secciones: SeccionInput[]) => Promise<void>;
  eliminarTipoDocumento: (id: string) => Promise<void>;

  // Acciones Operativas Trámite (persistidas vía /api/ceish/documentos)
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
    documentPath: string
  ) => Promise<Documento>;

  editarDocumento: (
    id: string,
    campos: { tema: string; descripcion: string; riesgoDeclarado: RiesgoTipo; riesgoConfirmado: RiesgoTipo | null; estado: DocumentoEstado },
    nuevoEvaluadorId?: string
  ) => Promise<void>;

  solicitarRevision: (documentoId: string, solicitanteNombre: string) => Promise<void>;

  guardarRespuestaAnexo: (
    emision: Omit<RespuestaAnexo, 'id' | 'emitidoAt' | 'resultado' | 'snapshotPreguntas'>,
    actorId?: string
  ) => Promise<void>;

  emitirAnexo: (
    emision: Omit<RespuestaAnexo, 'id' | 'emitidoAt' | 'resultado' | 'snapshotPreguntas'>,
    resultado: RespuestaAnexo['resultado'],
    nuevoEstado: DocumentoEstado,
    cambioComentario?: string,
    nuevoRiesgoConfirmado?: RiesgoTipo
  ) => Promise<void>;

  darseDeBajaRevisor: (
    documentoId: string,
    evaluadorId: string,
    evaluadorNombre: string,
    comentarioConflicto: string
  ) => Promise<void>;

  elevarRiesgo: (
    documentoId: string,
    evaluadorId: string,
    evaluadorNombre: string,
    nuevoRiesgoConfirmado: RiesgoTipo,
    justificacion: string
  ) => Promise<void>;

  subirCorreccion: (
    documentoId: string,
    file: File,
    investigadorNombre: string,
    comentario: string
  ) => Promise<void>;

  enviarNotificacionManual: (destinatarioIds: string[], mensaje: string) => Promise<void>;
  marcarNotificacionLeida: (id: string) => Promise<void>;

  crearEscalamiento: (
    documentoId: string,
    seccionId: string,
    anexoTemplateId: string,
    comentarioEvaluador: string,
    respuestaAnexoId: string
  ) => Promise<void>;
  resolverEscalamiento: (id: string, edicionAdmin: string) => Promise<void>;

  resetearDatos: () => Promise<void>;
}

// ============================================================================
// STORE INITIAL STATE SEEDER
// ============================================================================
// Las 7 entidades del motor son server-side desde la Etapa 4 de la migración
// a PostgreSQL (ver CEISH_AVANCE.md): el estado inicial es solo un placeholder
// vacío hasta que cargarConfiguracion() hidrata todo desde la API.

const generarEstadoInicial = () => ({
  anexosTemplates: [] as AnexoTemplate[],
  tiposDocumento: [] as TipoDocumento[],
  documentos: [] as Documento[],
  respuestasAnexos: [] as RespuestaAnexo[],
  asignaciones: [] as AsignacionCEISH[],
  escalamientos: [] as Escalamiento[],
  notificaciones: [] as Notificacion[]
});

const estadoInicialSemilla = generarEstadoInicial();

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================
export const useCeishStore = create<CeishState>()((set) => ({
  ...estadoInicialSemilla,

  cargarConfiguracion: async () => {
    const [anexosTemplates, tiposDocumento, documentos, asignaciones, respuestasAnexos, escalamientos, notificaciones] = await Promise.all([
      ceishService.getAnexoTemplates(),
      ceishService.getTiposDocumento(),
      ceishService.getDocumentos(),
      ceishService.getAsignaciones(),
      ceishService.getRespuestasAnexo(),
      ceishService.getEscalamientos(),
      ceishService.getNotificaciones(),
    ]);
    set({ anexosTemplates, tiposDocumento, documentos, asignaciones, respuestasAnexos, escalamientos, notificaciones });
  },

  // CRUD Anexos
  crearAnexoTemplate: async (numero, nombre, rol, preguntas, wordTemplateName, wordTemplateObjectKey) => {
    const nuevo = await ceishService.createAnexoTemplate(
      numero, nombre, rol, preguntas, wordTemplateName ?? null, wordTemplateObjectKey ?? null,
    );
    set((state) => ({ anexosTemplates: [...state.anexosTemplates, nuevo] }));
  },

      editarAnexoTemplate: async (id, numero, nombre, rol, preguntasInput, wordTemplateName, wordTemplateObjectKey) => {
        // Las reglas de Congelamiento v3 (sección 7: purgar respuestas obsoletas
        // + notificar) las aplica el servidor dentro de la misma transacción;
        // aquí solo recargamos respuestasAnexos porque el servidor pudo haberlas
        // modificado para documentos activos que usan este anexo.
        const { template, notificaciones } = await ceishService.updateAnexoTemplate(
          id, numero, nombre, rol, preguntasInput, wordTemplateName ?? null, wordTemplateObjectKey ?? null,
        );
        const respuestasAnexos = await ceishService.getRespuestasAnexo();
        set((state) => {
          const idx = state.anexosTemplates.findIndex(t => t.id === id);
          const nuevosTemplates = [...state.anexosTemplates];
          if (idx !== -1) nuevosTemplates[idx] = template;
          return {
            anexosTemplates: nuevosTemplates,
            respuestasAnexos,
            notificaciones: [...state.notificaciones, ...notificaciones]
          };
        });
      },

      eliminarAnexoTemplate: async (id) => {
        // El servidor también limpia ceish_tipos_documento, purga respuestas de
        // documentos activos y notifica — todo en una sola transacción.
        const { notificaciones } = await ceishService.deleteAnexoTemplate(id);
        const [tiposDocumento, respuestasAnexos] = await Promise.all([
          ceishService.getTiposDocumento(),
          ceishService.getRespuestasAnexo(),
        ]);
        set((state) => ({
          anexosTemplates: state.anexosTemplates.filter(t => t.id !== id),
          tiposDocumento,
          respuestasAnexos,
          notificaciones: [...state.notificaciones, ...notificaciones]
        }));
      },

      // CRUD Tipos de Documento
      crearTipoDocumento: async (nombre, secciones) => {
        const nuevo = await ceishService.createTipoDocumento(nombre, secciones);
        set((state) => ({ tiposDocumento: [...state.tiposDocumento, nuevo] }));
      },

      editarTipoDocumento: async (id, nombre, secciones) => {
        const actualizado = await ceishService.updateTipoDocumento(id, nombre, secciones);
        set((state) => {
          const idx = state.tiposDocumento.findIndex(t => t.id === id);
          if (idx === -1) return {};
          const nuevosTipos = [...state.tiposDocumento];
          nuevosTipos[idx] = actualizado;
          return { tiposDocumento: nuevosTipos };
        });
      },

      eliminarTipoDocumento: async (id) => {
        await ceishService.deleteTipoDocumento(id);
        set((state) => ({ tiposDocumento: state.tiposDocumento.filter(t => t.id !== id) }));
      },

      // Acciones Operativas Trámite
      crearDocumento: async (
        tipoDocumentoId,
        tema,
        descripcion,
        autores,
        riesgoDeclarado,
        miembrosCeishDeclarados,
        investigadorId,
        investigadorNombre,
        documentName,
        documentPath
      ) => {
        const { documento, notificaciones } = await ceishService.crearDocumento({
          tipoDocumentoId, tema, descripcion, autores, riesgoDeclarado, miembrosCeishDeclarados,
          investigadorId, investigadorNombre, documentName, documentPath,
        });
        // crearDocumento pudo haber insertado una asignación ciega en el servidor;
        // recargamos la lista completa en vez de intentar reconstruirla localmente.
        const asignaciones = await ceishService.getAsignaciones();
        set((state) => ({
          documentos: [...state.documentos, documento],
          asignaciones,
          notificaciones: [...state.notificaciones, ...notificaciones],
        }));
        return documento;
      },

      editarDocumento: async (id, campos, nuevoEvaluadorId) => {
        const result = await ceishService.editarDocumento(id, campos, nuevoEvaluadorId);
        const asignaciones = await ceishService.getAsignaciones();
        set((state) => {
          const docIdx = state.documentos.findIndex(d => d.id === id);
          const nuevosDocs = [...state.documentos];
          if (docIdx === -1) nuevosDocs.push(result.documento);
          else nuevosDocs[docIdx] = result.documento;
          return {
            documentos: nuevosDocs,
            asignaciones,
            notificaciones: [...state.notificaciones, ...result.notificaciones],
          };
        });
      },

      solicitarRevision: async (documentoId, solicitanteNombre) => {
        const { documento, notificaciones } = await ceishService.solicitarRevision(documentoId, solicitanteNombre);
        const asignaciones = await ceishService.getAsignaciones();
        set((state) => {
          const docIdx = state.documentos.findIndex(d => d.id === documentoId);
          const nuevosDocs = [...state.documentos];
          if (docIdx !== -1) nuevosDocs[docIdx] = documento;
          return {
            documentos: nuevosDocs,
            asignaciones,
            notificaciones: [...state.notificaciones, ...notificaciones],
          };
        });
      },

      guardarRespuestaAnexo: async (emision, actorId) => {
        const { respuesta: nuevaResp, notificaciones } = await ceishService.guardarRespuestaAnexo(emision, actorId);
        set((state) => {
          const index = state.respuestasAnexos.findIndex(
            re => re.documentoId === nuevaResp.documentoId && re.anexoTemplateId === nuevaResp.anexoTemplateId && re.versionArchivoId === nuevaResp.versionArchivoId
          );
          const nuevasRespuestas = [...state.respuestasAnexos];
          if (index !== -1) nuevasRespuestas[index] = nuevaResp;
          else nuevasRespuestas.push(nuevaResp);
          return {
            respuestasAnexos: nuevasRespuestas,
            notificaciones: [...state.notificaciones, ...notificaciones],
          };
        });
      },

      emitirAnexo: async (emision, resultado, nuevoEstado, cambioComentario, nuevoRiesgoConfirmado) => {
        const { documento, respuesta, notificaciones } = await ceishService.emitirAnexo({
          ...emision, resultado, nuevoEstado, cambioComentario, nuevoRiesgoConfirmado,
        });
        // emitirAnexo puede desactivar asignaciones (aprobada/anulada); recargamos completo.
        const asignaciones = nuevoEstado === 'aprobada' || nuevoEstado === 'anulada'
          ? await ceishService.getAsignaciones()
          : null;
        set((state) => {
          const docIdx = state.documentos.findIndex(d => d.id === emision.documentoId);
          const nuevosDocs = [...state.documentos];
          if (docIdx !== -1) nuevosDocs[docIdx] = documento;

          const respIdx = state.respuestasAnexos.findIndex(
            re => re.documentoId === respuesta.documentoId && re.anexoTemplateId === respuesta.anexoTemplateId && re.versionArchivoId === respuesta.versionArchivoId
          );
          const nuevasRespuestas = [...state.respuestasAnexos];
          if (respIdx !== -1) nuevasRespuestas[respIdx] = respuesta;
          else nuevasRespuestas.push(respuesta);

          return {
            documentos: nuevosDocs,
            respuestasAnexos: nuevasRespuestas,
            asignaciones: asignaciones ?? state.asignaciones,
            notificaciones: [...state.notificaciones, ...notificaciones],
          };
        });
      },

      darseDeBajaRevisor: async (documentoId, evaluadorId, evaluadorNombre, comentarioConflicto) => {
        const { documento, notificaciones } = await ceishService.darseDeBajaRevisor(
          documentoId, evaluadorId, evaluadorNombre, comentarioConflicto,
        );
        const [asignaciones, respuestasAnexos] = await Promise.all([
          ceishService.getAsignaciones(),
          ceishService.getRespuestasAnexo(documentoId),
        ]);
        set((state) => {
          const docIdx = state.documentos.findIndex(d => d.id === documentoId);
          const nuevosDocs = [...state.documentos];
          if (docIdx !== -1) nuevosDocs[docIdx] = documento;

          const otrasRespuestas = state.respuestasAnexos.filter(r => r.documentoId !== documentoId);

          return {
            documentos: nuevosDocs,
            asignaciones,
            respuestasAnexos: [...otrasRespuestas, ...respuestasAnexos],
            notificaciones: [...state.notificaciones, ...notificaciones],
          };
        });
      },

      elevarRiesgo: async (documentoId, evaluadorId, evaluadorNombre, nuevoRiesgoConfirmado, justificacion) => {
        const { documento, notificaciones } = await ceishService.elevarRiesgo(
          documentoId, evaluadorId, evaluadorNombre, nuevoRiesgoConfirmado, justificacion,
        );
        const asignaciones = await ceishService.getAsignaciones();
        set((state) => {
          const docIdx = state.documentos.findIndex(d => d.id === documentoId);
          const nuevosDocs = [...state.documentos];
          if (docIdx !== -1) nuevosDocs[docIdx] = documento;
          return {
            documentos: nuevosDocs,
            asignaciones,
            notificaciones: [...state.notificaciones, ...notificaciones],
          };
        });
      },

      subirCorreccion: async (documentoId, file, investigadorNombre, comentario) => {
        const { documento } = await ceishService.subirCorreccion(documentoId, file, investigadorNombre, comentario);
        const asignaciones = await ceishService.getAsignaciones();
        set((state) => {
          const docIdx = state.documentos.findIndex(d => d.id === documentoId);
          const nuevosDocs = [...state.documentos];
          if (docIdx !== -1) nuevosDocs[docIdx] = documento;
          return { documentos: nuevosDocs, asignaciones };
        });
      },

      // Notificaciones (persistidas vía /api/ceish/notificaciones)
      enviarNotificacionManual: async (destinatarioIds, mensaje) => {
        const notificaciones = await ceishService.enviarNotificacionManual(destinatarioIds, mensaje);
        set((state) => ({ notificaciones: [...state.notificaciones, ...notificaciones] }));
      },

      marcarNotificacionLeida: async (id) => {
        const actualizada = await ceishService.marcarNotificacionLeida(id);
        set((state) => ({
          notificaciones: state.notificaciones.map(n => n.id === id ? actualizada : n)
        }));
      },

      // Escalamientos (persistidos vía /api/ceish/escalamientos)
      crearEscalamiento: async (documentoId, seccionId, anexoTemplateId, comentarioEvaluador, respuestaAnexoId) => {
        const { escalamiento, notificaciones } = await ceishService.crearEscalamiento(
          documentoId, seccionId, anexoTemplateId, comentarioEvaluador, respuestaAnexoId,
        );
        set((state) => ({
          escalamientos: [...state.escalamientos, escalamiento],
          notificaciones: [...state.notificaciones, ...notificaciones]
        }));
      },

      resolverEscalamiento: async (id, edicionAdmin) => {
        const actualizado = await ceishService.resolverEscalamiento(id, edicionAdmin);
        set((state) => ({
          escalamientos: state.escalamientos.map(e => e.id === id ? actualizado : e)
        }));
      },

      // Reinicia los datos operativos de demo en el servidor (documentos,
      // respuestas, asignaciones, escalamientos, notificaciones) y recarga
      // todo. No toca anexosTemplates/tiposDocumento: son configuración del
      // administrador, no datos de prueba desechables.
      resetearDatos: async () => {
        await ceishService.resetDemoData();
        await useCeishStore.getState().cargarConfiguracion();
      },
    }));
