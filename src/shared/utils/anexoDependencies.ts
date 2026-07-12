// Resuelve si un anexo está desbloqueado según `requiereAnexoIds` (transitivo)
// de la configuración del TipoDocumento. "Respondido" = existe un
// RespuestaAnexo (borrador o emisión) para ese anexo, documento y versión —
// mismo criterio que `isAnexoCompletado` en SubmissionPage.tsx.
import type { AnexoAsignado, RespuestaAnexo } from '../types/platform.types';

export interface EstadoDependenciasAnexo {
  desbloqueado: boolean;
  faltantes: string[]; // anexoTemplateIds (directos o transitivos) aún sin responder
}

export function resolverDependenciasAnexo(
  anexoTemplateId: string,
  anexosAsignados: AnexoAsignado[],
  respuestasAnexos: RespuestaAnexo[],
  documentoId: string,
  versionArchivoId: string | undefined,
): EstadoDependenciasAnexo {
  const porId = new Map(anexosAsignados.map(a => [a.anexoTemplateId, a]));
  const estaRespondido = (id: string) =>
    respuestasAnexos.some(r =>
      r.documentoId === documentoId && r.anexoTemplateId === id && r.versionArchivoId === versionArchivoId,
    );

  const visitados = new Set<string>([anexoTemplateId]);
  const faltantes: string[] = [];

  const recorrer = (id: string) => {
    for (const reqId of porId.get(id)?.requiereAnexoIds ?? []) {
      if (visitados.has(reqId)) continue;
      visitados.add(reqId);
      if (!estaRespondido(reqId)) faltantes.push(reqId);
      recorrer(reqId);
    }
  };
  recorrer(anexoTemplateId);

  return { desbloqueado: faltantes.length === 0, faltantes };
}
