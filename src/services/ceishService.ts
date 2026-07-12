// ============================================================================
// ceishService — capa de mapeo DB↔UI para el motor CEISH v3 (workflow
// configurable). Sigue el mismo patrón que platformService.ts: DTOs con
// columnas en snake_case en el nivel superior; los campos JSONB (preguntas,
// secciones) ya vienen en el mismo camelCase que platform.types.ts, así que
// no necesitan mapeo interno, solo pasar a través.
// ============================================================================

import type {
  AnexoTemplate, Pregunta, TipoDocumento, Seccion, AnexoAsignado,
  Documento, Autor, RiesgoTipo, DocumentoEstado, AsignacionCEISH,
  VersionArchivo, HistorialEstado, Cronometro, RespuestaAnexo, ValorCampo, ComentarioAnotacion,
  Notificacion, Escalamiento,
} from '../shared/types/platform.types';

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function extractError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return (body as { error?: string }).error ?? fallback;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await extractError(res, `GET ${path} → ${res.status}`));
  return res.json() as Promise<T>;
}

async function apiSend<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await extractError(res, `${method} ${path} → ${res.status}`));
  return res.json() as Promise<T>;
}

// ─── DTOs (forma cruda que devuelve la API) ──────────────────────────────────

interface AnexoTemplateDTO {
  id: string;
  numero: number;
  nombre: string;
  rol: 'investigador' | 'evaluador';
  preguntas: Pregunta[];
  word_template_name: string | null;
  word_template_object_key: string | null;
}

interface TipoDocumentoDTO {
  id: string;
  nombre: string;
  secciones: Seccion[];
}

interface DocumentoDTO {
  id: string;
  codigo: string;
  tipo_documento_id: string;
  tema: string;
  descripcion: string;
  investigador_id: string;
  autores: Autor[];
  riesgo_declarado: RiesgoTipo;
  riesgo_confirmado: RiesgoTipo | null;
  miembros_ceish_declarados: string[];
  estado: DocumentoEstado;
  versiones_archivo: VersionArchivo[];
  historial_estados: HistorialEstado[];
  cronometro: Cronometro | null;
  created_at: string;
}

interface AsignacionDTO {
  id: string;
  documento_id: string;
  seccion_id: string;
  evaluador_id: string;
  active: boolean;
  baja_motivo: string | null;
  baja_anexo_id: string | null;
  assigned_at: string;
}

interface NotificacionDTO {
  id: string;
  tipo: Notificacion['tipo'];
  destinatario_id: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
}

interface EscalamientoDTO {
  id: string;
  respuesta_anexo_id: string | null;
  documento_id: string;
  seccion_id: string;
  anexo_template_id: string;
  comentario_evaluador: string;
  estado: Escalamiento['estado'];
  edicion_admin: string | null;
  notificado: boolean;
  created_at: string;
}

interface RespuestaAnexoDTO {
  id: string;
  documento_id: string;
  anexo_template_id: string;
  seccion_id: string;
  version_archivo_id: string;
  emitido_por_id: string;
  emitido_por_nombre: string;
  emitido_at: string;
  resultado: RespuestaAnexo['resultado'];
  valores: ValorCampo[];
  comentarios_anotados: ComentarioAnotacion[];
  snapshot_preguntas: Pregunta[];
}

// ─── Mapeos BD → UI ──────────────────────────────────────────────────────────

function mapAnexoTemplate(d: AnexoTemplateDTO): AnexoTemplate {
  return {
    id: d.id,
    numero: d.numero,
    nombre: d.nombre,
    rol: d.rol,
    preguntas: d.preguntas,
    wordTemplateName: d.word_template_name ?? undefined,
    wordTemplateObjectKey: d.word_template_object_key ?? undefined,
  };
}

function mapTipoDocumento(d: TipoDocumentoDTO): TipoDocumento {
  return { id: d.id, nombre: d.nombre, secciones: d.secciones };
}

function mapDocumento(d: DocumentoDTO): Documento {
  return {
    id: d.id,
    codigo: d.codigo,
    tipoDocumentoId: d.tipo_documento_id,
    tema: d.tema,
    descripcion: d.descripcion,
    investigadorId: d.investigador_id,
    autores: d.autores,
    riesgoDeclarado: d.riesgo_declarado,
    riesgoConfirmado: d.riesgo_confirmado ?? undefined,
    miembrosCeishDeclarados: d.miembros_ceish_declarados,
    estado: d.estado,
    versionesArchivo: d.versiones_archivo,
    historialEstados: d.historial_estados,
    cronometro: d.cronometro ?? undefined,
    createdAt: d.created_at,
  };
}

function mapAsignacion(d: AsignacionDTO): AsignacionCEISH {
  return {
    id: d.id,
    documentoId: d.documento_id,
    evaluadorId: d.evaluador_id,
    seccionId: d.seccion_id,
    assignedAt: d.assigned_at,
    active: d.active,
    bajaMotivo: d.baja_motivo ?? undefined,
    bajaAnexoId: d.baja_anexo_id ?? undefined,
  };
}

function mapRespuestaAnexo(d: RespuestaAnexoDTO): RespuestaAnexo {
  return {
    id: d.id,
    anexoTemplateId: d.anexo_template_id,
    documentoId: d.documento_id,
    seccionId: d.seccion_id,
    versionArchivoId: d.version_archivo_id,
    emitidoPorId: d.emitido_por_id,
    emitidoPorNombre: d.emitido_por_nombre,
    emitidoAt: d.emitido_at,
    resultado: d.resultado,
    valores: d.valores,
    comentariosAnotados: d.comentarios_anotados,
    snapshotPreguntas: d.snapshot_preguntas,
  };
}

function mapNotificacion(d: NotificacionDTO): Notificacion {
  return {
    id: d.id,
    tipo: d.tipo,
    destinatarioId: d.destinatario_id,
    mensaje: d.mensaje,
    leida: d.leida,
    createdAt: d.created_at,
  };
}

function mapEscalamiento(d: EscalamientoDTO): Escalamiento {
  return {
    id: d.id,
    respuestaAnexoId: d.respuesta_anexo_id ?? '',
    documentoId: d.documento_id,
    seccionId: d.seccion_id,
    anexoTemplateId: d.anexo_template_id,
    comentarioEvaluador: d.comentario_evaluador,
    estado: d.estado,
    edicionAdmin: d.edicion_admin ?? undefined,
    notificado: d.notificado,
    createdAt: d.created_at,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const ceishService = {
  // Plantillas de Anexo
  async getAnexoTemplates(): Promise<AnexoTemplate[]> {
    const data = await apiGet<AnexoTemplateDTO[]>('/api/ceish/anexo-templates');
    return data.map(mapAnexoTemplate);
  },

  async createAnexoTemplate(
    numero: number,
    nombre: string,
    rol: 'investigador' | 'evaluador',
    preguntas: (Omit<Pregunta, 'id'> & { id?: string })[],
    wordTemplateName: string | null,
    wordTemplateObjectKey: string | null,
  ): Promise<AnexoTemplate> {
    const data = await apiSend<AnexoTemplateDTO>('POST', '/api/ceish/anexo-templates', {
      numero, nombre, rol, preguntas, wordTemplateName, wordTemplateObjectKey,
    });
    return mapAnexoTemplate(data);
  },

  async updateAnexoTemplate(
    id: string,
    numero: number,
    nombre: string,
    rol: 'investigador' | 'evaluador',
    preguntas: (Omit<Pregunta, 'id'> & { id?: string })[],
    wordTemplateName: string | null,
    wordTemplateObjectKey: string | null,
  ): Promise<{ template: AnexoTemplate; notificaciones: Notificacion[] }> {
    const data = await apiSend<{ template: AnexoTemplateDTO; notificaciones: NotificacionDTO[] }>(
      'PUT', `/api/ceish/anexo-templates/${id}`,
      { numero, nombre, rol, preguntas, wordTemplateName, wordTemplateObjectKey },
    );
    return { template: mapAnexoTemplate(data.template), notificaciones: data.notificaciones.map(mapNotificacion) };
  },

  async deleteAnexoTemplate(id: string): Promise<{ notificaciones: Notificacion[] }> {
    const data = await apiSend<{ notificaciones: NotificacionDTO[] }>('DELETE', `/api/ceish/anexo-templates/${id}`);
    return { notificaciones: data.notificaciones.map(mapNotificacion) };
  },

  // Tipos de Documento
  async getTiposDocumento(): Promise<TipoDocumento[]> {
    const data = await apiGet<TipoDocumentoDTO[]>('/api/ceish/tipos-documento');
    return data.map(mapTipoDocumento);
  },

  async createTipoDocumento(
    nombre: string,
    secciones: { id?: string; nombre: string; orden: number; anexos: AnexoAsignado[] }[],
  ): Promise<TipoDocumento> {
    const data = await apiSend<TipoDocumentoDTO>('POST', '/api/ceish/tipos-documento', { nombre, secciones });
    return mapTipoDocumento(data);
  },

  async updateTipoDocumento(
    id: string,
    nombre: string,
    secciones: { id?: string; nombre: string; orden: number; anexos: AnexoAsignado[] }[],
  ): Promise<TipoDocumento> {
    const data = await apiSend<TipoDocumentoDTO>('PUT', `/api/ceish/tipos-documento/${id}`, { nombre, secciones });
    return mapTipoDocumento(data);
  },

  async deleteTipoDocumento(id: string): Promise<void> {
    await apiSend('DELETE', `/api/ceish/tipos-documento/${id}`);
  },

  // Documentos (trámites)
  async getDocumentos(investigadorId?: string): Promise<Documento[]> {
    const qs = investigadorId ? `?investigadorId=${investigadorId}` : '';
    const data = await apiGet<DocumentoDTO[]>(`/api/ceish/documentos${qs}`);
    return data.map(mapDocumento);
  },

  async getDocumentoById(id: string): Promise<Documento | null> {
    try {
      const data = await apiGet<DocumentoDTO>(`/api/ceish/documentos/${id}`);
      return mapDocumento(data);
    } catch {
      return null;
    }
  },

  async crearDocumento(input: {
    tipoDocumentoId: string;
    tema: string;
    descripcion: string;
    autores: Autor[];
    riesgoDeclarado: RiesgoTipo;
    miembrosCeishDeclarados: string[];
    investigadorId: string;
    investigadorNombre: string;
    documentName: string;
    documentPath: string;
  }): Promise<{ documento: Documento; notificaciones: Notificacion[] }> {
    const data = await apiSend<{ documento: DocumentoDTO; notificaciones: NotificacionDTO[] }>(
      'POST', '/api/ceish/documentos', input,
    );
    return { documento: mapDocumento(data.documento), notificaciones: data.notificaciones.map(mapNotificacion) };
  },

  async editarDocumento(
    id: string,
    campos: { tema: string; descripcion: string; riesgoDeclarado: RiesgoTipo; riesgoConfirmado: RiesgoTipo | null; estado: DocumentoEstado },
    nuevoEvaluadorId?: string,
  ): Promise<{ documento: Documento; notificaciones: Notificacion[] }> {
    const data = await apiSend<{ documento: DocumentoDTO; notificaciones: NotificacionDTO[] }>(
      'PATCH', `/api/ceish/documentos/${id}`, { ...campos, nuevoEvaluadorId },
    );
    return { documento: mapDocumento(data.documento), notificaciones: data.notificaciones.map(mapNotificacion) };
  },

  async solicitarRevision(
    documentoId: string, solicitanteNombre: string,
  ): Promise<{ documento: Documento; notificaciones: Notificacion[] }> {
    const data = await apiSend<{ documento: DocumentoDTO; notificaciones: NotificacionDTO[] }>(
      'POST', `/api/ceish/documentos/${documentoId}/solicitar-revision`, { solicitanteNombre },
    );
    return { documento: mapDocumento(data.documento), notificaciones: data.notificaciones.map(mapNotificacion) };
  },

  async subirCorreccion(
    documentoId: string, file: File, investigadorNombre: string, comentario: string,
  ): Promise<{ documento: Documento }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('investigadorNombre', investigadorNombre);
    formData.append('comentario', comentario);
    const res = await fetch(`/api/ceish/documentos/${documentoId}/subir-correccion`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(await extractError(res, `Error ${res.status} al subir la corrección`));
    const data = await res.json() as { documento: DocumentoDTO };
    return { documento: mapDocumento(data.documento) };
  },

  async darseDeBajaRevisor(
    documentoId: string, evaluadorId: string, evaluadorNombre: string, comentarioConflicto: string,
  ): Promise<{ documento: Documento; notificaciones: Notificacion[] }> {
    const data = await apiSend<{ documento: DocumentoDTO; notificaciones: NotificacionDTO[] }>(
      'POST', `/api/ceish/documentos/${documentoId}/baja-revisor`, { evaluadorId, evaluadorNombre, comentarioConflicto },
    );
    return { documento: mapDocumento(data.documento), notificaciones: data.notificaciones.map(mapNotificacion) };
  },

  async elevarRiesgo(
    documentoId: string, evaluadorId: string, evaluadorNombre: string,
    nuevoRiesgoConfirmado: RiesgoTipo, justificacion: string,
  ): Promise<{ documento: Documento; notificaciones: Notificacion[] }> {
    const data = await apiSend<{ documento: DocumentoDTO; notificaciones: NotificacionDTO[] }>(
      'POST', `/api/ceish/documentos/${documentoId}/elevar-riesgo`,
      { evaluadorId, evaluadorNombre, nuevoRiesgoConfirmado, justificacion },
    );
    return { documento: mapDocumento(data.documento), notificaciones: data.notificaciones.map(mapNotificacion) };
  },

  // Asignaciones
  async getAsignaciones(): Promise<AsignacionCEISH[]> {
    const data = await apiGet<AsignacionDTO[]>('/api/ceish/asignaciones');
    return data.map(mapAsignacion);
  },

  // Respuestas de Anexo (borradores + emisiones)
  async getRespuestasAnexo(documentoId?: string): Promise<RespuestaAnexo[]> {
    const qs = documentoId ? `?documentoId=${documentoId}` : '';
    const data = await apiGet<RespuestaAnexoDTO[]>(`/api/ceish/respuestas${qs}`);
    return data.map(mapRespuestaAnexo);
  },

  async guardarRespuestaAnexo(input: {
    documentoId: string;
    anexoTemplateId: string;
    seccionId: string;
    versionArchivoId: string;
    emitidoPorId: string;
    emitidoPorNombre: string;
    valores: ValorCampo[];
    comentariosAnotados: ComentarioAnotacion[];
  }): Promise<RespuestaAnexo> {
    const data = await apiSend<RespuestaAnexoDTO>('PUT', '/api/ceish/respuestas', input);
    return mapRespuestaAnexo(data);
  },

  async emitirAnexo(input: {
    documentoId: string;
    anexoTemplateId: string;
    seccionId: string;
    versionArchivoId: string;
    emitidoPorId: string;
    emitidoPorNombre: string;
    valores: ValorCampo[];
    comentariosAnotados: ComentarioAnotacion[];
    resultado: RespuestaAnexo['resultado'];
    nuevoEstado: DocumentoEstado;
    cambioComentario?: string;
    nuevoRiesgoConfirmado?: RiesgoTipo;
  }): Promise<{ documento: Documento; respuesta: RespuestaAnexo; notificaciones: Notificacion[] }> {
    const data = await apiSend<{ documento: DocumentoDTO; respuesta: RespuestaAnexoDTO; notificaciones: NotificacionDTO[] }>(
      'POST', '/api/ceish/respuestas/emitir', input,
    );
    return {
      documento: mapDocumento(data.documento),
      respuesta: mapRespuestaAnexo(data.respuesta),
      notificaciones: data.notificaciones.map(mapNotificacion),
    };
  },

  // Notificaciones
  async getNotificaciones(destinatarioId?: string): Promise<Notificacion[]> {
    const qs = destinatarioId ? `?destinatarioId=${destinatarioId}` : '';
    const data = await apiGet<NotificacionDTO[]>(`/api/ceish/notificaciones${qs}`);
    return data.map(mapNotificacion);
  },

  async enviarNotificacionManual(destinatarioIds: string[], mensaje: string): Promise<Notificacion[]> {
    const data = await apiSend<NotificacionDTO[]>('POST', '/api/ceish/notificaciones/manual', { destinatarioIds, mensaje });
    return data.map(mapNotificacion);
  },

  async marcarNotificacionLeida(id: string): Promise<Notificacion> {
    const data = await apiSend<NotificacionDTO>('PATCH', `/api/ceish/notificaciones/${id}/leida`);
    return mapNotificacion(data);
  },

  // Escalamientos
  async getEscalamientos(estado?: Escalamiento['estado']): Promise<Escalamiento[]> {
    const qs = estado ? `?estado=${estado}` : '';
    const data = await apiGet<EscalamientoDTO[]>(`/api/ceish/escalamientos${qs}`);
    return data.map(mapEscalamiento);
  },

  async crearEscalamiento(
    documentoId: string,
    seccionId: string,
    anexoTemplateId: string,
    comentarioEvaluador: string,
    respuestaAnexoId: string,
  ): Promise<{ escalamiento: Escalamiento; notificaciones: Notificacion[] }> {
    const data = await apiSend<{ escalamiento: EscalamientoDTO; notificaciones: NotificacionDTO[] }>(
      'POST', '/api/ceish/escalamientos', { documentoId, seccionId, anexoTemplateId, comentarioEvaluador, respuestaAnexoId },
    );
    return { escalamiento: mapEscalamiento(data.escalamiento), notificaciones: data.notificaciones.map(mapNotificacion) };
  },

  async resolverEscalamiento(id: string, edicionAdmin: string): Promise<Escalamiento> {
    const data = await apiSend<EscalamientoDTO>('PUT', `/api/ceish/escalamientos/${id}/resolver`, { edicionAdmin });
    return mapEscalamiento(data);
  },

  // Archivos (MinIO genérico por clave: PDFs, adjuntos, plantillas Word)
  async uploadFile(file: File): Promise<{ documentPath: string; documentName: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Error ${res.status} al subir el archivo`);
    }
    return res.json();
  },

  /** Descarga los bytes crudos de un archivo (p. ej. una plantilla Word) para procesarlo en el navegador. */
  async fetchFileBytes(objectKey: string): Promise<Uint8Array> {
    const res = await fetch(`/api/ceish/files/${objectKey}/raw`);
    if (!res.ok) throw new Error(`GET /api/ceish/files/${objectKey}/raw → ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  },

  getFileRawUrl(objectKey: string): string {
    return `/api/ceish/files/${objectKey}/raw`;
  },

  // Reset de datos de demo (solo desarrollo)
  async resetDemoData(): Promise<void> {
    await apiSend('POST', '/api/ceish/reset-demo-data');
  },
};
