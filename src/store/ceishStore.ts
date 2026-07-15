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
  CampoTipo,
  ValorCampo,
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
// NOTIFICACIONES: DESTINATARIOS FIJOS Y HELPER DE FAN-OUT
// ============================================================================
// IDs simulados de administradores (mismo esquema de IDs deterministas usado
// en database/seed.sql y replicado en USUARIOS_REGISTRADOS de CrearInvestigacionModal.tsx)
const ADMIN_IDS = ['a0000000-0000-0000-0000-000000000001'];

const buildNotificaciones = (
  destinatarios: (string | undefined)[],
  mensaje: string,
  timestamp: string,
  tipo: Notificacion['tipo'] = 'automatica'
): Notificacion[] =>
  Array.from(new Set(destinatarios.filter((d): d is string => Boolean(d)))).map((destinatarioId) => ({
    id: generateUUID(),
    tipo,
    destinatarioId,
    mensaje,
    leida: false,
    createdAt: timestamp
  }));

// Etiquetas legibles para armar mensajes de notificación con el detalle de qué cambió
const ESTADO_LABELS: Record<DocumentoEstado, string> = {
  creada: 'Borrador',
  estratificacion: 'Estratificación',
  'revision-tecnica': 'Revisión Técnica',
  aprobada: 'Aprobada',
  anulada: 'Anulada'
};

const RIESGO_LABELS: Record<RiesgoTipo, string> = {
  'sin-riesgo': 'Sin Riesgo',
  'riesgo-minimo': 'Riesgo Mínimo',
  'riesgo-mayor': 'Riesgo Mayor'
};

// Compara el documento original contra los campos entrantes de editarDocumento y
// describe en texto plano qué cambió puntualmente (para notificaciones personalizadas)
const describirCambiosDocumento = (
  doc: Documento,
  campos: Partial<Pick<Documento, 'tema' | 'descripcion' | 'riesgoDeclarado' | 'riesgoConfirmado' | 'estado'>>
): string[] => {
  const cambios: string[] = [];

  if (campos.tema !== undefined && campos.tema !== doc.tema) {
    cambios.push(`título: "${doc.tema}" → "${campos.tema}"`);
  }
  if (campos.descripcion !== undefined && campos.descripcion !== doc.descripcion) {
    cambios.push('descripción/justificación');
  }
  if (campos.riesgoDeclarado !== undefined && campos.riesgoDeclarado !== doc.riesgoDeclarado) {
    cambios.push(`riesgo declarado: ${RIESGO_LABELS[doc.riesgoDeclarado]} → ${RIESGO_LABELS[campos.riesgoDeclarado]}`);
  }
  if (campos.riesgoConfirmado !== undefined && campos.riesgoConfirmado !== doc.riesgoConfirmado) {
    const antes = doc.riesgoConfirmado ? RIESGO_LABELS[doc.riesgoConfirmado] : 'sin confirmar';
    cambios.push(`riesgo confirmado: ${antes} → ${RIESGO_LABELS[campos.riesgoConfirmado]}`);
  }
  if (campos.estado !== undefined && campos.estado !== doc.estado) {
    cambios.push(`estado: ${ESTADO_LABELS[doc.estado]} → ${ESTADO_LABELS[campos.estado]}`);
  }

  return cambios;
};

const CAMPO_TIPO_LABELS: Record<CampoTipo, string> = {
  checklist: 'Checklist',
  'texto-libre': 'Respuesta Abierta',
  archivo: 'Adjuntar Archivo',
  'si-no': 'Sí / No'
};

// Compara las preguntas de un AnexoTemplate antes/después de una edición y describe
// en texto plano qué pregunta se agregó, eliminó, o tuvo su texto/tipo de campo editado
// (para notificaciones personalizadas, en vez de un mensaje genérico "se modificaron preguntas")
const describirCambiosPreguntas = (preguntasAntes: Pregunta[], preguntasDespues: Pregunta[]): string[] => {
  const cambios: string[] = [];

  preguntasDespues.forEach(np => {
    const op = preguntasAntes.find(p => p.id === np.id);
    if (!op) {
      cambios.push(`pregunta agregada: "${np.texto}"`);
      return;
    }
    if (op.texto !== np.texto) {
      cambios.push(`pregunta editada: "${op.texto}" → "${np.texto}"`);
    }
    if (op.tipo !== np.tipo) {
      cambios.push(`tipo de campo cambiado en "${np.texto}": ${CAMPO_TIPO_LABELS[op.tipo]} → ${CAMPO_TIPO_LABELS[np.tipo]}`);
    }
  });

  preguntasAntes.forEach(op => {
    const stillExists = preguntasDespues.some(np => np.id === op.id);
    if (!stillExists) {
      cambios.push(`pregunta eliminada: "${op.texto}"`);
    }
  });

  return cambios;
};

const RESULTADO_LABELS: Record<RespuestaAnexo['resultado'], string> = {
  coincide: 'Coincide',
  discrepa: 'Discrepa',
  aprobado: 'Aprobado',
  'con-observaciones': 'Con observaciones',
  baja: 'Baja/Revocatoria',
  'conflicto-interes': 'Conflicto de interés'
};

const formatValorNotificacion = (valor: unknown): string => {
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (valor && typeof valor === 'object' && 'documentName' in (valor as Record<string, unknown>)) {
    return String((valor as { documentName: unknown }).documentName);
  }
  if (valor === undefined || valor === null || valor === '') return '(vacío)';
  return String(valor);
};

// Compara los valores (respuestas) de un anexo antes/después de sobrescribirlo y describe
// en texto plano qué pregunta cambió de valor (para notificar ediciones de respuestas ya enviadas)
const describirCambiosValores = (
  preguntas: Pregunta[],
  valoresAntes: ValorCampo[],
  valoresDespues: ValorCampo[]
): string[] => {
  const cambios: string[] = [];

  valoresDespues.forEach(vd => {
    const va = valoresAntes.find(v => v.campoId === vd.campoId);
    const antes = va ? va.valor : undefined;
    if (JSON.stringify(antes) !== JSON.stringify(vd.valor)) {
      const pregunta = preguntas.find(p => p.id === vd.campoId);
      const etiqueta = pregunta ? pregunta.texto : vd.campoId;
      cambios.push(`"${etiqueta}": ${formatValorNotificacion(antes)} → ${formatValorNotificacion(vd.valor)}`);
    }
  });

  return cambios;
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
  wordTemplateName?: string,
  wordTemplateBase64?: string,
  customId?: string
): Partial<CeishState> => {
  const id = customId || `anexo-${generateUUID()}`;
  const preguntas: Pregunta[] = preguntasInput.map((p, idx) => ({
    id: `preg-${generateUUID()}`,
    texto: p.texto,
    tipo: p.tipo,
    descripcionContexto: p.descripcionContexto,
    orden: p.orden ?? idx + 1,
    key: p.key || `tag_${idx + 1}`
  }));

  const nuevoTemplate: AnexoTemplate = { 
    id, 
    numero, 
    nombre, 
    rol, 
    preguntas,
    wordTemplateName,
    wordTemplateBase64
  };
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
    wordTemplateName?: string,
    wordTemplateBase64?: string,
    customId?: string
  ) => void;
  editarAnexoTemplate: (
    id: string,
    numero: number,
    nombre: string,
    rol: 'investigador' | 'evaluador',
    preguntas: (Omit<Pregunta, 'id'> & { id?: string })[],
    wordTemplateName?: string,
    wordTemplateBase64?: string
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
    emision: Omit<RespuestaAnexo, 'id' | 'emitidoAt' | 'resultado' | 'snapshotPreguntas'>,
    actorId?: string
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
  enviarNotificacionManual: (destinatarioIds: string[], mensaje: string) => void;
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
// STORE INITIAL STATE SEEDER
// ============================================================================
const SEED_DOCX_BASE64 = "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";

const generarEstadoInicial = () => {
  let temp = {
    anexosTemplates: [] as AnexoTemplate[],
    tiposDocumento: [] as TipoDocumento[],
    documentos: seedDocumentos(),
    respuestasAnexos: [] as RespuestaAnexo[],
    asignaciones: seedAsignaciones(),
    escalamientos: [] as Escalamiento[],
    notificaciones: [] as Notificacion[]
  };

  // 1. Acumular Anexos 1 a 9 del Investigador
  temp = { ...temp, ...addAnexoTemplateToState(temp as any, 1, 'Solicitud de Revisión Técnica', 'investigador', [
    { texto: 'Título descriptivo del proyecto de investigación', tipo: 'texto-libre', orden: 1, key: 'tema' },
    { texto: 'Breve justificación e hipótesis de trabajo', tipo: 'texto-libre', orden: 2, key: 'observaciones' }
  ], 'plantilla_oficial_ceish.docx', SEED_DOCX_BASE64, 'anexo-1') } as any;

  for (let i = 2; i <= 9; i++) {
    temp = { ...temp, ...addAnexoTemplateToState(temp as any, i, `Anexo ${i} Formulario de Ficha Ética`, 'investigador', [
      { texto: `Pregunta declaratoria de cumplimiento Anexo ${i}`, tipo: 'checklist', orden: 1, key: `cumplimiento_anexo_${i}` }
    ], 'plantilla_oficial_ceish.docx', SEED_DOCX_BASE64, `anexo-${i}`) } as any;
  }

  // 2. Acumular Anexos del Evaluador (Estratificación y Evaluación)
  temp = { ...temp, ...addAnexoTemplateToState(temp as any, 27, 'Formato para Estratificación de Riesgos', 'evaluador', [
    { texto: '1. ¿La investigación involucra procedimientos que puedan causar daño físico o psicológico directo al sujeto?', tipo: 'checklist', orden: 1, key: 'procedimientos_riesgo' },
    { texto: '2. ¿Se recolectan datos personales sensibles o información privada de carácter confidencial?', tipo: 'checklist', orden: 2, key: 'datos_sensibles' },
    { texto: '3. ¿Se utilizan muestras biológicas humanas (sangre, tejidos, fluidos)?', tipo: 'checklist', orden: 3, key: 'muestras_biologicas' },
    { texto: '4. ¿Involucra poblaciones vulnerables (niños, personas con discapacidad, etc.)?', tipo: 'checklist', orden: 4, key: 'poblaciones_vulnerables' },
    { texto: 'Justificación / Criterio final del revisor', tipo: 'texto-libre', orden: 5, key: 'observaciones' }
  ], 'plantilla_oficial_ceish.docx', SEED_DOCX_BASE64, 'anexo-27') } as any;

  temp = { ...temp, ...addAnexoTemplateToState(temp as any, 11, 'Formato de Carta de Exención (Sin Riesgo)', 'evaluador', [
    { texto: 'Justificación técnica del cumplimiento de criterios de exención ética', tipo: 'texto-libre', orden: 1, key: 'observaciones' },
    { texto: 'Declaración formal de exención de revisión por el comité CEISH', tipo: 'checklist', orden: 2, key: 'declaracion_exencion' }
  ], 'plantilla_oficial_ceish.docx', SEED_DOCX_BASE64, 'anexo-11') } as any;

  temp = { ...temp, ...addAnexoTemplateToState(temp as any, 23, 'Declaración de Conflicto de Intereses', 'evaluador', [
    { texto: 'Describa detalladamente la causa de su conflicto de interés con el proyecto o sus autores', tipo: 'texto-libre', orden: 1, key: 'observaciones' },
    { texto: 'Declaración juramentada de inhibición en el proceso de evaluación', tipo: 'checklist', orden: 2, key: 'declaracion_inhibicion' }
  ], 'plantilla_oficial_ceish.docx', SEED_DOCX_BASE64, 'anexo-23') } as any;

  temp = { ...temp, ...addAnexoTemplateToState(temp as any, 12, 'Check List de Evaluación de Proyecto', 'evaluador', [
    { texto: 'A. Título de la investigación descriptivo y delimitado', tipo: 'checklist', orden: 1, key: 'titulo_valido' },
    { texto: 'B. Justificación teórica y empírica del problema de investigación', tipo: 'checklist', orden: 2, key: 'justificacion_valida' },
    { texto: 'C. Objetivos específicos coherentes con el objetivo general', tipo: 'checklist', orden: 3, key: 'objetivos_coherentes' },
    { texto: 'D. Diseño metodológico adecuado y detallado', tipo: 'checklist', orden: 4, key: 'diseno_metodologico' },
    { texto: 'E. Consideraciones éticas aplicables debidamente fundamentadas', tipo: 'checklist', orden: 5, key: 'consideraciones_eticas' },
    { texto: 'F. Observaciones generales detalladas', tipo: 'texto-libre', orden: 6, key: 'observaciones' }
  ], 'plantilla_oficial_ceish.docx', SEED_DOCX_BASE64, 'anexo-12') } as any;

  temp = { ...temp, ...addAnexoTemplateToState(temp as any, 13, 'Formato para emisión de resoluciones de aprobación', 'evaluador', [
    { texto: 'Declaración formal de Aprobación Ética y Metodológica', tipo: 'checklist', orden: 1, key: 'declaracion_aprobacion' },
    { texto: 'Términos y condiciones de la aprobación del proyecto', tipo: 'texto-libre', orden: 2, key: 'observaciones' }
  ], 'plantilla_oficial_ceish.docx', SEED_DOCX_BASE64, 'anexo-13') } as any;

  temp = { ...temp, ...addAnexoTemplateToState(temp as any, 26, 'Resolución de suspensión o revocatoria', 'evaluador', [
    { texto: 'Motivos de la suspensión/revocatoria (vencimiento de plazos, faltas éticas, etc.)', tipo: 'texto-libre', orden: 1, key: 'observaciones' },
    { texto: 'Declaración formal de suspensión de la validez del certificado aprobatorio', tipo: 'checklist', orden: 2, key: 'declaracion_suspension' }
  ], 'plantilla_oficial_ceish.docx', SEED_DOCX_BASE64, 'anexo-26') } as any;

  // 3. Crear el Tipo de Documento "Investigación" asociando las plantillas dinámicas
  temp = { ...temp, ...addTipoDocumentoToState(temp as any, 'Investigación', [
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
  ], 'tipo-investigacion') } as any;

  return temp;
};

const estadoInicialSemilla = generarEstadoInicial();

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================
export const useCeishStore = create<CeishState>()(
  persist(
    (set) => ({
      ...estadoInicialSemilla,

      // CRUD Anexos
      crearAnexoTemplate: (numero, nombre, rol, preguntas, wordTemplateName, wordTemplateBase64, customId) => set((state) => ({
        ...state,
        ...addAnexoTemplateToState(state, numero, nombre, rol, preguntas, wordTemplateName, wordTemplateBase64, customId)
      })),

      editarAnexoTemplate: (id, numero, nombre, rol, preguntasInput, wordTemplateName, wordTemplateBase64) => set((state) => {
        const idx = state.anexosTemplates.findIndex(t => t.id === id);
        if (idx === -1) return {};

        const oldTemplate = state.anexosTemplates[idx];
        const nuevasPreguntas: Pregunta[] = preguntasInput.map((p, pIdx) => ({
          id: p.id || `preg-${generateUUID()}`,
          texto: p.texto,
          tipo: p.tipo,
          descripcionContexto: p.descripcionContexto,
          orden: p.orden ?? pIdx + 1,
          key: p.key || `tag_${pIdx + 1}`
        }));

        const nuevoTemplate: AnexoTemplate = { 
          ...oldTemplate, 
          numero, 
          nombre, 
          rol, 
          preguntas: nuevasPreguntas,
          wordTemplateName: wordTemplateName !== undefined ? wordTemplateName : oldTemplate.wordTemplateName,
          wordTemplateBase64: wordTemplateBase64 !== undefined ? wordTemplateBase64 : oldTemplate.wordTemplateBase64
        };
        const nuevosTemplates = [...state.anexosTemplates];
        nuevosTemplates[idx] = nuevoTemplate;

        // Reglas de Congelamiento v3 (Sección 7):
        // Identificar documentos activos (excluyendo cerrados: aprobada o anulada)
        const docsActivos = state.documentos.filter(d => d.estado !== 'aprobada' && d.estado !== 'anulada');
        const docsActivosIds = new Set(docsActivos.map(d => d.id));

        const nuevasRespuestas = state.respuestasAnexos.map(resp => {
          if (resp.anexoTemplateId === id && docsActivosIds.has(resp.documentoId)) {
            // Filtrar respuestas a preguntas que fueron eliminadas o modificadas
            const valoresFiltrados = resp.valores.filter(val => {
              const nuevaPreg = nuevasPreguntas.find(p => p.id === val.campoId);
              const viejaPreg = oldTemplate.preguntas.find(p => p.id === val.campoId);
              if (!nuevaPreg) return false; // Pregunta borrada
              if (viejaPreg && viejaPreg.texto !== nuevaPreg.texto) return false; // Pregunta con texto editado
              return true;
            });

            return {
              ...resp,
              valores: valoresFiltrados
            };
          }
          return resp;
        });

        // Notificación (5a): cualquier cambio estructural en las preguntas (añadida,
        // eliminada o editada) avisa a investigador + evaluadores activos de TODOS los
        // documentos activos que usan esta plantilla, no solo a quien ya la había respondido.
        // El mensaje detalla puntualmente qué pregunta(s) cambiaron.
        const cambiosPreguntas = describirCambiosPreguntas(oldTemplate.preguntas, nuevasPreguntas);

        const timestamp = new Date().toISOString();
        let nuevasNotificaciones: Notificacion[] = [];

        if (cambiosPreguntas.length > 0) {
          const docsConEsteAnexo = docsActivos.filter(d =>
            state.tiposDocumento
              .find(t => t.id === d.tipoDocumentoId)
              ?.secciones.some(s => s.anexos.some(a => a.anexoTemplateId === id))
          );

          nuevasNotificaciones = docsConEsteAnexo.flatMap(d => {
            const evaluadoresActivos = state.asignaciones
              .filter(a => a.documentoId === d.id && a.active)
              .map(a => a.evaluadorId);
            return buildNotificaciones(
              [d.investigadorId, ...evaluadoresActivos],
              `El Administrador modificó el Anexo ${numero} (${nombre}) en el proyecto ${d.codigo}: ${cambiosPreguntas.join('; ')}.`,
              timestamp
            );
          });
        }

        return {
          anexosTemplates: nuevosTemplates,
          respuestasAnexos: nuevasRespuestas,
          notificaciones: [...state.notificaciones, ...nuevasNotificaciones]
        };
      }),

      eliminarAnexoTemplate: (id) => set((state) => {
        const template = state.anexosTemplates.find(t => t.id === id);
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
        const docsActivos = state.documentos.filter(d => d.estado !== 'aprobada' && d.estado !== 'anulada');
        const docsActivosIds = new Set(docsActivos.map(d => d.id));

        const nuevasRespuestas = state.respuestasAnexos.filter(
          resp => !(resp.anexoTemplateId === id && docsActivosIds.has(resp.documentoId))
        );

        // Notificación (5a): avisar a investigador + evaluadores activos de los
        // documentos activos que usaban esta plantilla antes de eliminarla.
        const timestamp = new Date().toISOString();
        const docsConEsteAnexo = docsActivos.filter(d =>
          state.tiposDocumento
            .find(t => t.id === d.tipoDocumentoId)
            ?.secciones.some(s => s.anexos.some(a => a.anexoTemplateId === id))
        );

        const nuevasNotificaciones = docsConEsteAnexo.flatMap(d => {
          const evaluadoresActivos = state.asignaciones
            .filter(a => a.documentoId === d.id && a.active)
            .map(a => a.evaluadorId);
          return buildNotificaciones(
            [d.investigadorId, ...evaluadoresActivos],
            `El Administrador eliminó el Anexo ${template?.numero ?? ''} (${template?.nombre ?? ''}) del flujo del proyecto ${d.codigo}.`,
            timestamp
          );
        });

        return {
          anexosTemplates: nuevosTemplates,
          tiposDocumento: nuevosTipos,
          respuestasAnexos: nuevasRespuestas,
          notificaciones: [...state.notificaciones, ...nuevasNotificaciones]
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
        let nuevasNotificaciones: Notificacion[] = [];

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

          nuevasNotificaciones = buildNotificaciones(
            [investigadorId],
            `Tu proyecto ${codigo} avanzó a la etapa de Estratificación.`,
            timestamp
          ).concat(buildNotificaciones(
            [evaluadorSeleccionado.id],
            `Se te ha asignado el proyecto ${codigo} para evaluación.`,
            timestamp
          ));
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
          asignaciones: asignacionesActualizadas,
          notificaciones: [...state.notificaciones, ...nuevasNotificaciones]
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
        let nuevasNotificaciones: Notificacion[] = [];

        const evaluadoresActivosPrevios = state.asignaciones
          .filter(a => a.documentoId === id && a.active)
          .map(a => a.evaluadorId);

        // Notificación (5b): cualquier edición directa del documento por el admin
        // (tema, descripción, riesgo o estado) avisa a investigador + evaluador(es) activos,
        // detallando puntualmente qué campo(s) cambiaron.
        const cambiosDocumento = describirCambiosDocumento(doc, campos);
        if (cambiosDocumento.length > 0) {
          nuevasNotificaciones.push(...buildNotificaciones(
            [doc.investigadorId, ...evaluadoresActivosPrevios],
            `El Administrador modificó el proyecto ${doc.codigo}: ${cambiosDocumento.join('; ')}.`,
            timestamp
          ));
        }

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

          nuevasNotificaciones.push(...buildNotificaciones(
            [nuevoEvaluadorId],
            `Se te ha asignado el proyecto ${doc.codigo} para evaluación.`,
            timestamp
          ));
        }

        return {
          documentos: nuevosDocs,
          asignaciones: asignacionesActualizadas,
          notificaciones: [...state.notificaciones, ...nuevasNotificaciones]
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

        const nuevasNotificaciones = buildNotificaciones(
          [doc.investigadorId],
          `Tu proyecto ${doc.codigo} avanzó a la etapa de Estratificación.`,
          timestamp
        ).concat(buildNotificaciones(
          [evaluadorSeleccionado.id],
          `Se te ha asignado el proyecto ${doc.codigo} para evaluación.`,
          timestamp
        ));

        return {
          documentos: nuevosDocs,
          asignaciones: [...state.asignaciones, nuevaAsignacion],
          notificaciones: [...state.notificaciones, ...nuevasNotificaciones]
        };
      }),

      guardarRespuestaAnexo: (emision, actorId) => set((state) => {
        const index = state.respuestasAnexos.findIndex(
          re => re.documentoId === emision.documentoId && re.anexoTemplateId === emision.anexoTemplateId && re.versionArchivoId === emision.versionArchivoId
        );

        const template = state.anexosTemplates.find(t => t.id === emision.anexoTemplateId);
        if (!template) return {};

        const timestamp = new Date().toISOString();
        const anterior = index !== -1 ? state.respuestasAnexos[index] : null;

        const nuevaResp: RespuestaAnexo = {
          ...emision,
          id: anterior ? anterior.id : generateUUID(),
          emitidoAt: timestamp,
          // Preserva el resultado ya existente (borrador u oficial) en vez de degradarlo
          // siempre a 'coincide' — evita que sobrescribir valores invalide una emisión oficial.
          resultado: anterior ? anterior.resultado : 'coincide',
          snapshotPreguntas: template.preguntas
        };

        const nuevasRespuestas = [...state.respuestasAnexos];
        if (index !== -1) {
          nuevasRespuestas[index] = nuevaResp;
        } else {
          nuevasRespuestas.push(nuevaResp);
        }

        // Notificación: edición de una respuesta que ya existía (más allá del primer guardado).
        // El "actor" que realmente hace la edición puede diferir de emision.emitidoPorId
        // (ej. el evaluador edita una respuesta del investigador conservando su autoría original).
        let nuevasNotificaciones: Notificacion[] = [];
        if (anterior) {
          const cambiosValores = describirCambiosValores(template.preguntas, anterior.valores, emision.valores);
          if (cambiosValores.length > 0) {
            const doc = state.documentos.find(d => d.id === emision.documentoId);
            if (doc) {
              const quienEdita = actorId || emision.emitidoPorId;
              const esInvestigadorQuienEdita = quienEdita === doc.investigadorId;
              const evaluadoresActivos = state.asignaciones
                .filter(a => a.documentoId === emision.documentoId && a.active)
                .map(a => a.evaluadorId);

              const destinatarios = esInvestigadorQuienEdita ? evaluadoresActivos : [doc.investigadorId];
              const quien = esInvestigadorQuienEdita ? 'El investigador' : 'El evaluador';

              nuevasNotificaciones = buildNotificaciones(
                destinatarios,
                `${quien} modificó la respuesta del Anexo ${template.numero} (${template.nombre}) en el proyecto ${doc.codigo}: ${cambiosValores.join('; ')}.`,
                timestamp
              );
            }
          }
        }

        return {
          respuestasAnexos: nuevasRespuestas,
          notificaciones: [...state.notificaciones, ...nuevasNotificaciones]
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

        // Capturar la emisión anterior (si existía) ANTES de filtrarla, para poder
        // detectar si esto es una corrección de una respuesta ya enviada y describir qué cambió.
        const anteriorEmision = state.respuestasAnexos.find(
          re => re.documentoId === emision.documentoId && re.anexoTemplateId === emision.anexoTemplateId && re.versionArchivoId === emision.versionArchivoId
        );

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

        // 4. Notificaciones automáticas al investigador según la transición de estado
        const estadoAnterior = doc.estado;
        let nuevasNotificaciones: Notificacion[] = [];

        if (nuevoEstado === 'aprobada' && estadoAnterior !== 'aprobada') {
          nuevasNotificaciones.push(...buildNotificaciones(
            [doc.investigadorId],
            `Tu proyecto ${doc.codigo} ha sido aprobado ética y metodológicamente.`,
            timestamp
          ));
        }

        if (resultado === 'con-observaciones') {
          nuevasNotificaciones.push(...buildNotificaciones(
            [doc.investigadorId],
            `Se registraron observaciones en tu proyecto ${doc.codigo}.` + (cambioComentario ? ` ${cambioComentario}` : ''),
            timestamp
          ));
        }

        if (nuevoEstado === 'creada' && estadoAnterior !== 'creada') {
          nuevasNotificaciones.push(...buildNotificaciones(
            [doc.investigadorId],
            `Tu proyecto ${doc.codigo} fue regresado para corrección.` + (cambioComentario ? ` ${cambioComentario}` : ''),
            timestamp
          ));
        }

        if (
          nuevoEstado !== estadoAnterior &&
          nuevoEstado !== 'aprobada' &&
          nuevoEstado !== 'creada' &&
          nuevoEstado !== 'anulada'
        ) {
          nuevasNotificaciones.push(...buildNotificaciones(
            [doc.investigadorId],
            `Tu proyecto ${doc.codigo} avanzó a la etapa: ${nuevoEstado}.`,
            timestamp
          ));
        }

        // Corrección de una emisión ya enviada: si ya existía una respuesta oficial previa
        // para este anexo y algo cambió (resultado y/o valores), avisa al investigador con el
        // detalle puntual — esto puede coexistir con las notificaciones de arriba si además
        // cambió de etapa/resultado, o ser la única si solo se corrigió el contenido.
        if (anteriorEmision) {
          const cambiosEmision: string[] = [];
          if (anteriorEmision.resultado !== resultado) {
            cambiosEmision.push(`resultado: ${RESULTADO_LABELS[anteriorEmision.resultado]} → ${RESULTADO_LABELS[resultado]}`);
          }
          cambiosEmision.push(...describirCambiosValores(template.preguntas, anteriorEmision.valores, emision.valores));

          if (cambiosEmision.length > 0) {
            nuevasNotificaciones.push(...buildNotificaciones(
              [doc.investigadorId],
              `El evaluador corrigió su emisión del Anexo ${template.numero} (${template.nombre}) en tu proyecto ${doc.codigo}: ${cambiosEmision.join('; ')}.`,
              timestamp
            ));
          }
        }

        return {
          respuestasAnexos: [...filtradasResp, nuevaResp],
          documentos: nuevosDocs,
          asignaciones: nuevasAsignaciones,
          notificaciones: [...state.notificaciones, ...nuevasNotificaciones]
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
        let nuevasNotificaciones = buildNotificaciones(
          ADMIN_IDS,
          `El evaluador ${evaluadorNombre} declaró conflicto de interés en el proyecto ${doc.codigo}.`,
          timestamp
        );

        if (evaluadoresDisponibles.length > 0) {
          const randomIdx = Math.floor(Math.random() * evaluadoresDisponibles.length);
          const nuevoEvaluador = evaluadoresDisponibles[randomIdx];

          const nuevaAsignacion: AsignacionCEISH = {
            id: generateUUID(),
            documentoId,
            evaluadorId: nuevoEvaluador.id,
            seccionId: 'sec-evaluacion',
            assignedAt: timestamp,
            active: true
          };

          asignacionFinal.push(nuevaAsignacion);
          comentarioHistorial += ` Reasignado automáticamente al revisor: ${nuevoEvaluador.name} para la siguiente etapa.`;
          nuevasNotificaciones = nuevasNotificaciones.concat(buildNotificaciones(
            [nuevoEvaluador.id],
            `Se te ha asignado el proyecto ${doc.codigo} para evaluación técnica.`,
            timestamp
          ));
        } else {
          comentarioHistorial += ` No existen más revisores disponibles en la plataforma.`;
        }

        const docActualizado: Documento = {
          ...doc,
          estado: 'revision-tecnica',
          miembrosCeishDeclarados: exclusionesActualizadas,
          historialEstados: [
            ...doc.historialEstados,
            {
              estado: 'revision-tecnica',
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
          documentos: nuevosDocs,
          notificaciones: [...state.notificaciones, ...nuevasNotificaciones]
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

      enviarNotificacionManual: (destinatarioIds, mensaje) => set((state) => ({
        notificaciones: [
          ...state.notificaciones,
          ...buildNotificaciones(destinatarioIds, mensaje, new Date().toISOString(), 'manual')
        ]
      })),

      marcarNotificacionLeida: (id) => set((state) => ({
        notificaciones: state.notificaciones.map(n => n.id === id ? { ...n, leida: true } : n)
      })),

      // Escalamientos
      crearEscalamiento: (documentoId, seccionId, anexoTemplateId, comentarioEvaluador, respuestaAnexoId) => set((state) => {
        const timestamp = new Date().toISOString();
        const doc = state.documentos.find(d => d.id === documentoId);

        return {
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
              createdAt: timestamp
            }
          ],
          notificaciones: [
            ...state.notificaciones,
            ...buildNotificaciones(
              ADMIN_IDS,
              `Se escaló una situación del proyecto ${doc?.codigo ?? documentoId} que requiere tu resolución.`,
              timestamp
            )
          ]
        };
      }),

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
      resetearDatos: () => set((state) => ({
        ...state,
        ...generarEstadoInicial()
      }))
    }),
    {
      name: 'ceish-prototype-storage',
      merge: (persistedState: any, currentState) => {
        const merged = { ...currentState, ...persistedState };
        if (!merged.anexosTemplates || merged.anexosTemplates.length === 0) {
          merged.anexosTemplates = currentState.anexosTemplates;
        }
        if (!merged.tiposDocumento || merged.tiposDocumento.length === 0) {
          merged.tiposDocumento = currentState.tiposDocumento;
        }
        if (!merged.documentos || merged.documentos.length === 0) {
          merged.documentos = currentState.documentos;
        }
        if (!merged.asignaciones || merged.asignaciones.length === 0) {
          merged.asignaciones = currentState.asignaciones;
        }
        return merged;
      }
    }
  )
);
