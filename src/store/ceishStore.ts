import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  Investigacion, 
  AnexoTemplate, 
  EmisionAnexo, 
  AsignacionCEISH,
  RiesgoTipo,
  InvestigacionEstado,
  VersionArchivo
} from '../shared/types/platform.types';

// Helper seguro para generar UUIDs en el navegador
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

// Carga inicial estática de las plantillas de anexos (Configuradas exactamente según CampoTipo)
const initialTemplates: AnexoTemplate[] = [
  {
    id: 'anexo-27',
    numero: 27,
    nombre: 'Formato para Estratificación de Riesgos',
    campos: [
      { id: 'a27_c1', label: '1. ¿La investigación involucra procedimientos que puedan causar daño físico o psicológico directo al sujeto?', tipo: 'cumple-nocumple' },
      { id: 'a27_c2', label: '2. ¿Se recolectan datos personales sensibles o información privada de carácter confidencial?', tipo: 'cumple-nocumple' },
      { id: 'a27_c3', label: '3. ¿Se utilizan muestras biológicas humanas (sangre, tejidos, fluidos)?', tipo: 'cumple-nocumple' },
      { id: 'a27_c4', label: '4. ¿Involucra poblaciones vulnerables (niños, personas con discapacidad, etc.)?', tipo: 'cumple-nocumple' },
      { id: 'a27_c5', label: 'Justificación / Criterio final del revisor', tipo: 'texto-libre' }
    ]
  },
  {
    id: 'anexo-11',
    numero: 11,
    nombre: 'Formato de Carta de Exención (Sin Riesgo)',
    campos: [
      { id: 'a11_c1', label: 'Justificación técnica del cumplimiento de criterios de exención ética', tipo: 'texto-libre' },
      { id: 'a11_c2', label: 'Declaración formal de exención de revisión por el comité CEISH', tipo: 'cumple-nocumple' }
    ]
  },
  {
    id: 'anexo-12',
    numero: 12,
    nombre: 'Check List de Evaluación de los proyectos de investigación',
    campos: [
      { id: 'a12_c1', label: 'A. Título de la investigación descriptivo y delimitado', tipo: 'cumple-nocumple' },
      { id: 'a12_c2', label: 'B. Justificación teórica y empírica del problema de investigación', tipo: 'cumple-nocumple' },
      { id: 'a12_c3', label: 'C. Objetivos específicos coherentes con el objetivo general', tipo: 'cumple-nocumple' },
      { id: 'a12_c4', label: 'D. Diseño metodológico adecuado y detallado', tipo: 'cumple-nocumple' },
      { id: 'a12_c5', label: 'E. Consideraciones éticas aplicables debidamente fundamentadas', tipo: 'cumple-nocumple' },
      { id: 'a12_obs', label: 'F. Observaciones generales detalladas', tipo: 'texto-libre' }
    ]
  },
  {
    id: 'anexo-13',
    numero: 13,
    nombre: 'Formato para emisión de resoluciones de aprobación',
    campos: [
      { id: 'a13_c1', label: 'Declaración formal de Aprobación Ética y Metodológica', tipo: 'cumple-nocumple' },
      { id: 'a13_c2', label: 'Términos y condiciones de la aprobación del proyecto', tipo: 'texto-libre' }
    ]
  },
  {
    id: 'anexo-23',
    numero: 23,
    nombre: 'Declaracion de conflicto de intereses de los miembros del CEISH-Uleam',
    campos: [
      { id: 'a23_c1', label: '1. Describa detalladamente la causa de su conflicto de interés con el proyecto o sus autores', tipo: 'texto-libre' },
      { id: 'a23_c2', label: 'Declaración juramentada de inhibición en el proceso de evaluación', tipo: 'cumple-nocumple' }
    ]
  },
  {
    id: 'anexo-26',
    numero: 26,
    nombre: 'Formato para suspensión o revocatoria de la aprobación de proyecto de investigación',
    campos: [
      { id: 'a26_c1', label: '1. Motivos de la suspensión/revocatoria (vencimiento de plazos, faltas éticas, etc.)', tipo: 'texto-libre' },
      { id: 'a26_c2', label: 'Declaración formal de suspensión de la validez del certificado aprobatorio', tipo: 'cumple-nocumple' }
    ]
  }
];

// Seed de investigaciones de prueba para mejorar la experiencia interactiva
const seedInvestigaciones = (): Investigacion[] => [
  {
    id: 'inv-seed-001',
    codigo: 'CEISH-2026-0001',
    tema: 'Uso de pantallas y desarrollo lingüístico en infantes',
    descripcion: 'Análisis descriptivo del impacto del tiempo frente a pantallas en el vocabulario expresivo en niños de 2 a 4 años.',
    investigadorId: 'c0000000-0000-0000-0000-000000000001', // Juan Pérez
    autores: ['Juan Pérez', 'Dra. María Andrade'],
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
    tema: 'Percepción docente sobre la educación inclusiva',
    descripcion: 'Estudio de encuesta para medir actitudes y barreras percibidas por docentes de secundaria ante la inclusión educativa.',
    investigadorId: 'c0000000-0000-0000-0000-000000000002', // María López
    autores: ['María López', 'Mag. Carlos Estévez'],
    riesgoDeclarado: 'sin-riesgo',
    miembrosCeishDeclarados: [],
    estado: 'estratificacion',
    versionesArchivo: [
      {
        id: 'ver-seed-002',
        documentName: 'Protocolo_Inclusion_Final.pdf',
        documentPath: 'mock/seed-proyecto-final-juan.pdf', // Reusamos el pdf seed por simplicidad en el visor
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
    investigacionId: 'inv-seed-002',
    evaluadorId: 'b0000000-0000-0000-0000-000000000001', // Profesor Demo
    tipoRevision: 'estratificacion',
    assignedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    active: true
  }
];

interface CeishState {
  investigaciones: Investigacion[];
  anexosEmitidos: EmisionAnexo[];
  asignaciones: AsignacionCEISH[];
  templates: AnexoTemplate[];
  
  // Acciones
  crearInvestigacion: (
    tema: string,
    descripcion: string,
    autores: string[],
    riesgoDeclarado: RiesgoTipo,
    miembrosCeishDeclarados: string[],
    investigadorId: string,
    investigadorNombre: string,
    documentName: string,
    documentPath: string
  ) => void;
  
  solicitarRevision: (investigacionId: string, solicitanteNombre: string) => void;
  
  guardarBorradorAnexo: (emision: Omit<EmisionAnexo, 'id' | 'emitidoAt'>) => void;
  
  emitirAnexo: (
    emision: Omit<EmisionAnexo, 'id' | 'emitidoAt'>,
    resultado: EmisionAnexo['resultado'],
    nuevoEstado: InvestigacionEstado,
    cambioComentario?: string
  ) => void;
  
  darseDeBajaRevisor: (
    investigacionId: string,
    evaluadorId: string,
    evaluadorNombre: string,
    comentarioConflicto: string
  ) => void;
  
  resetearDatos: () => void;
}

export const useCeishStore = create<CeishState>()(
  persist(
    (set) => ({
      investigaciones: seedInvestigaciones(),
      anexosEmitidos: [],
      asignaciones: seedAsignaciones(),
      templates: initialTemplates,

      crearInvestigacion: (
        tema,
        descripcion,
        autores,
        riesgoDeclarado,
        miembrosCeishDeclarados,
        investigadorId,
        investigadorNombre,
        documentName,
        documentPath
      ) => set((state) => {
        const id = generateUUID();
        const correlativo = String(state.investigaciones.length + 1).padStart(4, '0');
        const codigo = `CEISH-2026-${correlativo}`;
        const timestamp = new Date().toISOString();

        const nuevaVersion: VersionArchivo = {
          id: generateUUID(),
          documentName,
          documentPath,
          comment: 'Documento inicial cargado al crear la investigación.',
          uploadedAt: timestamp
        };

        const nuevaInv: Investigacion = {
          id,
          codigo,
          tema,
          descripcion,
          investigadorId,
          autores,
          riesgoDeclarado,
          miembrosCeishDeclarados,
          estado: 'creada',
          versionesArchivo: [nuevaVersion],
          historialEstados: [
            {
              estado: 'creada',
              changedAt: timestamp,
              changedBy: investigadorNombre,
              comment: 'Investigación creada en borrador.'
            }
          ],
          createdAt: timestamp
        };

        return {
          investigaciones: [...state.investigaciones, nuevaInv]
        };
      }),

      solicitarRevision: (investigacionId, solicitanteNombre) => set((state) => {
        const timestamp = new Date().toISOString();
        
        // 1. Encontrar investigación
        const invIdx = state.investigaciones.findIndex(i => i.id === investigacionId);
        if (invIdx === -1) return {};

        const inv = state.investigaciones[invIdx];
        
        // 2. Seleccionar un evaluador aleatorio excluyendo a los declarados en conflicto
        // Se asume la lista de evaluadores conocidos del sistema para el mock
        const evaluadoresSistema = [
          { id: 'b0000000-0000-0000-0000-000000000001', name: 'Profesor Demo' },
          { id: 'b0000000-0000-0000-0000-000000000002', name: 'Evaluador Alterno CEISH' },
          { id: 'b0000000-0000-0000-0000-000000000003', name: 'Dr. Roberto Anchundia' }
        ];

        // Filtrar evaluadores que NO estén en conflicto
        const evaluadoresDisponibles = evaluadoresSistema.filter(
          ev => !inv.miembrosCeishDeclarados.includes(ev.id)
        );

        if (evaluadoresDisponibles.length === 0) {
          throw new Error('No existen evaluadores disponibles sin conflicto de interés en la plataforma.');
        }

        // Selección aleatoria
        const randomIdx = Math.floor(Math.random() * evaluadoresDisponibles.length);
        const evaluadorSeleccionado = evaluadoresDisponibles[randomIdx];

        // 3. Crear asignación
        const nuevaAsignacion: AsignacionCEISH = {
          id: generateUUID(),
          investigacionId,
          evaluadorId: evaluadorSeleccionado.id,
          tipoRevision: 'estratificacion',
          assignedAt: timestamp,
          active: true
        };

        // 4. Modificar la investigación
        const invActualizada: Investigacion = {
          ...inv,
          estado: 'estratificacion',
          historialEstados: [
            ...inv.historialEstados,
            {
              estado: 'estratificacion',
              changedAt: timestamp,
              changedBy: solicitanteNombre,
              comment: `Solicitud enviada a revisión. Revisor asignado de forma aleatoria y ciega.`
            }
          ]
        };

        const nuevasInvestigaciones = [...state.investigaciones];
        nuevasInvestigaciones[invIdx] = invActualizada;

        return {
          investigaciones: nuevasInvestigaciones,
          asignaciones: [...state.asignaciones, nuevaAsignacion]
        };
      }),

      guardarBorradorAnexo: (emision) => set((state) => {
        // Buscar si ya existe una emisión borrador para esta investigación y plantilla
        const index = state.anexosEmitidos.findIndex(
          ae => ae.investigacionId === emision.investigacionId && ae.anexoId === emision.anexoId
        );

        const timestamp = new Date().toISOString();
        const nuevaEmision: EmisionAnexo = {
          ...emision,
          id: index !== -1 ? state.anexosEmitidos[index].id : generateUUID(),
          emitidoAt: timestamp
        };

        const nuevosAnexos = [...state.anexosEmitidos];
        if (index !== -1) {
          nuevosAnexos[index] = nuevaEmision;
        } else {
          nuevosAnexos.push(nuevaEmision);
        }

        return {
          anexosEmitidos: nuevosAnexos
        };
      }),

      emitirAnexo: (emision, resultado, nuevoEstado, cambioComentario) => set((state) => {
        const timestamp = new Date().toISOString();
        const emisionId = generateUUID();

        // 1. Registrar emisión oficial
        const nuevaEmision: EmisionAnexo = {
          ...emision,
          id: emisionId,
          emitidoAt: timestamp,
          resultado
        };

        // Filtrar algún borrador previo de este mismo anexo/proyecto para limpiarlo
        const filtradosAnexos = state.anexosEmitidos.filter(
          ae => !(ae.investigacionId === emision.investigacionId && ae.anexoId === emision.anexoId)
        );

        // 2. Modificar el estado de la investigación
        const invIdx = state.investigaciones.findIndex(i => i.id === emision.investigacionId);
        if (invIdx === -1) return {};

        const inv = state.investigaciones[invIdx];
        
        const cronometroActualizado = nuevoEstado === 'aprobada' 
          ? { fechaAprobacion: timestamp, diasEjecucion: 365 } // 365 días por defecto
          : inv.cronometro;

        const invActualizada: Investigacion = {
          ...inv,
          estado: nuevoEstado,
          riesgoConfirmado: emision.anexoId === 'anexo-27' && resultado === 'coincide' ? inv.riesgoDeclarado : inv.riesgoConfirmado,
          cronometro: cronometroActualizado,
          historialEstados: [
            ...inv.historialEstados,
            {
              estado: nuevoEstado,
              changedAt: timestamp,
              changedBy: emision.emitidoPorNombre,
              comment: cambioComentario || `Emisión oficial del ${emision.anexoId.toUpperCase()}`
            }
          ]
        };

        const nuevasInvestigaciones = [...state.investigaciones];
        nuevasInvestigaciones[invIdx] = invActualizada;

        // 3. Si se aprueba o anula, desactivamos todas las asignaciones
        let nuevasAsignaciones = state.asignaciones;
        if (nuevoEstado === 'aprobada' || nuevoEstado === 'anulada') {
          nuevasAsignaciones = state.asignaciones.map(asig => 
            asig.investigacionId === emision.investigacionId ? { ...asig, active: false } : asig
          );
        }

        return {
          anexosEmitidos: [...filtradosAnexos, nuevaEmision],
          investigaciones: nuevasInvestigaciones,
          asignaciones: nuevasAsignaciones
        };
      }),

      darseDeBajaRevisor: (investigacionId, evaluadorId, evaluadorNombre, comentarioConflicto) => set((state) => {
        const timestamp = new Date().toISOString();
        const anexo23Id = generateUUID();

        // 1. Crear la emisión simulada de conflicto de interés (Anexo 23)
        const emisionConflicto: EmisionAnexo = {
          id: anexo23Id,
          anexoId: 'anexo-23',
          investigacionId,
          etapa: 'estratificacion',
          versionArchivoId: state.investigaciones.find(i => i.id === investigacionId)?.versionesArchivo.slice(-1)[0]?.id || '',
          emitidoPorId: evaluadorId,
          emitidoPorNombre: evaluadorNombre,
          emitidoAt: timestamp,
          resultado: 'conflicto-interes',
          valores: [
            { campoId: 'a23_c1', valor: comentarioConflicto },
            { campoId: 'a23_c2', valor: true }
          ],
          comentariosAnotados: []
        };

        // 2. Dar de baja la asignación actual
        const nuevasAsignaciones = state.asignaciones.map((asig) => {
          if (asig.investigacionId === investigacionId && asig.evaluadorId === evaluadorId && asig.active) {
            return {
              ...asig,
              active: false,
              bajaMotivo: 'Conflicto de interés declarado.',
              bajaAnexoId: anexo23Id
            };
          }
          return asig;
        });

        // 3. Volver la investigación a estado 'estratificacion' y agregar historial
        const invIdx = state.investigaciones.findIndex(i => i.id === investigacionId);
        if (invIdx === -1) return {};

        const inv = state.investigaciones[invIdx];

        // Añadir el evaluador actual a la exclusión permanente de conflicto para esta investigación
        const miembrosActualizados = Array.from(new Set([...inv.miembrosCeishDeclarados, evaluadorId]));

        // 4. Reasignar a un nuevo evaluador
        const evaluadoresSistema = [
          { id: 'b0000000-0000-0000-0000-000000000001', name: 'Profesor Demo' },
          { id: 'b0000000-0000-0000-0000-000000000002', name: 'Evaluador Alterno CEISH' },
          { id: 'b0000000-0000-0000-0000-000000000003', name: 'Dr. Roberto Anchundia' }
        ];

        const evaluadoresDisponibles = evaluadoresSistema.filter(
          ev => ev.id !== evaluadorId && !miembrosActualizados.includes(ev.id)
        );

        let asignacionFinal = nuevasAsignaciones;
        let historialComentario = `El revisor se ha dado de baja del proyecto por conflicto de interés (Anexo 23).`;

        if (evaluadoresDisponibles.length > 0) {
          const randomIdx = Math.floor(Math.random() * evaluadoresDisponibles.length);
          const nuevoEvaluador = evaluadoresDisponibles[randomIdx];

          const nuevaAsignacion: AsignacionCEISH = {
            id: generateUUID(),
            investigacionId,
            evaluadorId: nuevoEvaluador.id,
            tipoRevision: 'estratificacion',
            assignedAt: timestamp,
            active: true
          };

          asignacionFinal.push(nuevaAsignacion);
          historialComentario += ` Reasignado automáticamente al revisor: ${nuevoEvaluador.name}.`;
        } else {
          historialComentario += ` No existen más evaluadores disponibles en la plataforma en este momento.`;
        }

        const invActualizada: Investigacion = {
          ...inv,
          estado: 'estratificacion',
          miembrosCeishDeclarados: miembrosActualizados,
          historialEstados: [
            ...inv.historialEstados,
            {
              estado: 'estratificacion',
              changedAt: timestamp,
              changedBy: evaluadorNombre,
              comment: historialComentario
            }
          ]
        };

        const nuevasInvestigaciones = [...state.investigaciones];
        nuevasInvestigaciones[invIdx] = invActualizada;

        return {
          anexosEmitidos: [...state.anexosEmitidos, emisionConflicto],
          asignaciones: asignacionFinal,
          investigaciones: nuevasInvestigaciones
        };
      }),

      resetearDatos: () => set(() => ({
        investigaciones: seedInvestigaciones(),
        anexosEmitidos: [],
        asignaciones: seedAsignaciones(),
        templates: initialTemplates
      }))
    }),
    {
      name: 'ceish-prototype-storage', // Clave única para evitar conflictos en localStorage
    }
  )
);
