import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useCeishStore } from '../../store/ceishStore';
import { ceishFileCache } from '../../store/fileCache';
import { generateDocx } from '../../utils/docxGenerator';
import './evaluator.css';

export function EvaluatorSeguimiento() {
  const currentUser = useAuthStore((s) => s.currentUser)!;
  const { asignaciones, documentos, respuestasAnexos, anexosTemplates, tiposDocumento } = useCeishStore();

  // Estado para el documento seleccionado
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Filtrar asignaciones asociadas al evaluador
  const misAsignaciones = asignaciones.filter(
    (asig) => asig.evaluadorId === currentUser.id
  );

  // Mapear asignaciones a documentos correspondientes
  const misProyectos = misAsignaciones
    .map((asig) => {
      const doc = documentos.find((d) => d.id === asig.documentoId);
      return {
        asignacion: asig,
        documento: doc,
      };
    })
    .filter((item) => item.documento !== undefined);

  // Documento seleccionado actualmente
  const selectedItem = misProyectos.find((item) => item.documento!.id === selectedDocId);
  const selectedDoc = selectedItem?.documento;

  const getRiesgoBadge = (riesgo: string) => {
    const badges: Record<string, string> = {
      'sin-riesgo': 'eval-badge eval-badge--success',
      'riesgo-minimo': 'eval-badge eval-badge--in-progress',
      'riesgo-mayor': 'eval-badge eval-badge--rejected',
    };
    return badges[riesgo] || 'eval-badge';
  };

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { text: string; className: string }> = {
      creada: { text: 'Borrador / Creación', className: 'eval-badge eval-badge--pending' },
      estratificacion: { text: 'Etapa 2: Estratificación', className: 'eval-badge eval-badge--in-progress' },
      'revision-tecnica': { text: 'Etapa 3: Revisión Técnica', className: 'eval-badge' },
      aprobada: { text: 'Aprobada (Exenta)', className: 'eval-badge eval-badge--success' },
      anulada: { text: 'Anulada / Suspendida', className: 'eval-badge eval-badge--rejected' },
    };
    const badge = badges[estado] || { text: estado, className: 'eval-badge' };
    return <span className={badge.className}>{badge.text}</span>;
  };

  // Contar devoluciones de corrección (cuántas veces el documento regresó al estado 'creada')
  const getDevolucionesCount = (doc: any) => {
    if (!doc.historialEstados) return 0;
    return doc.historialEstados.filter((h: any, idx: number) => {
      if (h.estado === 'creada' && idx > 0) {
        return doc.historialEstados[idx - 1].estado !== 'creada';
      }
      return false;
    }).length;
  };

  // Contar devoluciones de corrección ocurridas en una etapa específica
  const getDevolucionesEtapa = (doc: any, sectionIndex: number) => {
    if (!doc.historialEstados) return 0;
    let count = 0;
    const history = doc.historialEstados;
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      if (curr.estado === 'creada') {
        if (sectionIndex === 1 && prev.estado === 'estratificacion') {
          count++;
        }
        if (sectionIndex === 2 && prev.estado === 'revision-tecnica') {
          count++;
        }
      }
    }
    return count;
  };

  // Obtener fechas de entrada y salida de cada sección
  const getEtapaFechas = (doc: any, sectionIndex: number) => {
    let entrada: string | null = null;
    let salida: string | null = null;
    const history = doc.historialEstados || [];

    if (sectionIndex === 0) {
      entrada = history[0]?.changedAt || null;
      const exitEntry = history.find((h: any) => h.estado !== 'creada');
      salida = exitEntry?.changedAt || null;
    } else if (sectionIndex === 1) {
      const enterEntry = history.find((h: any) => h.estado === 'estratificacion');
      entrada = enterEntry?.changedAt || null;
      const exitEntry = history.find(
        (h: any, idx: number) =>
          idx > 0 && h.estado !== 'estratificacion' && history[idx - 1].estado === 'estratificacion'
      );
      salida = exitEntry?.changedAt || null;
    } else if (sectionIndex === 2) {
      const enterEntry = history.find((h: any) => h.estado === 'revision-tecnica');
      entrada = enterEntry?.changedAt || null;
      const exitEntry = history.find((h: any) => h.estado === 'aprobada' || h.estado === 'anulada');
      salida = exitEntry?.changedAt || null;
    }

    return { entrada, salida };
  };

  // Función para descargar acta en Word (.docx)
  const handleDescargarWord = (doc: any, template: any) => {
    const resp = respuestasAnexos.find(
      (r) => r.documentoId === doc.id && r.anexoTemplateId === template.id
    );
    if (!resp) return;

    // Construir datos de inyección
    const dataToInject: Record<string, any> = {
      codigo: doc.codigo || '',
      tema: doc.tema || '',
      nombre_evaluador: 'Evaluador CEISH',
      fecha: new Date(resp.emitidoAt || Date.now()).toLocaleDateString('es-ES'),
      resultado: resp.resultado || 'Completado',
      observaciones: resp.resultado === 'con-observaciones' ? 'Devuelto con observaciones.' : 'Aprobado.',
    };

    // Procesar cada pregunta
    template.preguntas.forEach((p: any) => {
      const valorObj = resp.valores.find((v: any) => v.campoId === p.id);
      const val = valorObj ? valorObj.valor : undefined;
      const tag = p.key || `tag_${p.orden}`;

      if (p.tipo === 'checklist') {
        dataToInject[tag] = val ? 'SÍ' : '';
      } else if (p.tipo === 'si-no') {
        dataToInject[tag] =
          val === 'SI' || val === true || val === 'true'
            ? 'SÍ'
            : val === 'NO' || val === false || val === 'false'
            ? 'NO'
            : '';
      } else if (p.tipo === 'archivo') {
        dataToInject[tag] = val ? `Archivo adjunto: ${val.documentName}` : 'Sin archivo adjunto';
      } else {
        dataToInject[tag] = val || '';
      }
    });

    const fileName = `Anexo_${template.numero}_${doc.codigo || 'CEISH'}`;
    generateDocx(template.wordTemplateBase64, dataToInject, fileName);
  };

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Seguimiento de Proyectos</h1>
          <p className="page__subtitle">
            Monitoree la línea de tiempo, etapas y anexos completados de los proyectos bajo su cargo.
          </p>
        </div>
      </div>

      <div
        className="page__body"
        style={{
          display: 'grid',
          gridTemplateColumns: selectedDoc ? '1fr 480px' : '1fr',
          gap: '20px',
          alignItems: 'start',
          transition: 'grid-template-columns 0.3s ease',
        }}
      >
        {/* LADO IZQUIERDO: Listado de Proyectos */}
        <div
          className="card"
          style={{
            padding: '20px',
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>Proyectos Asignados ({misProyectos.length})</h3>
          </div>

          <div
            style={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              border: '1px solid #f1f5f9',
              borderRadius: '6px',
            }}
          >
            {misProyectos.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 10px' }}>
                <div className="empty-state__icon" style={{ margin: '0 auto 12px auto' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="1.5" />
                    <path d="M9 12h6" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="empty-state__title" style={{ fontSize: '14px', color: '#475569' }}>No tiene proyectos asignados</h3>
                <p className="empty-state__desc" style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                  Los proyectos asignados ciega o formalmente para evaluación aparecerán listados aquí.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12.5px', background: '#f8fafc' }}>
                    <th style={{ padding: '10px 12px' }}>Código</th>
                    <th style={{ padding: '10px 12px' }}>Tema / Título</th>
                    <th style={{ padding: '10px 12px' }}>Riesgo</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {misProyectos.map(({ documento }) => {
                    if (!documento) return null;
                    return (
                      <tr
                        key={documento.id}
                        onClick={() => setSelectedDocId(documento.id === selectedDocId ? null : documento.id)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          background: selectedDocId === documento.id ? '#f8fafc' : 'transparent',
                          transition: 'background 0.2s',
                        }}
                        className="hover-row"
                      >
                        <td style={{ padding: '12px', fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                          {documento.codigo}
                        </td>
                        <td style={{ padding: '12px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 500, fontSize: '13.5px', color: '#0f172a' }} title={documento.tema}>
                            {documento.tema}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span className={getRiesgoBadge(documento.riesgoDeclarado)}>
                            {documento.riesgoDeclarado.replace('-', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="eval-btn eval-btn--outline"
                            style={{ padding: '4px 10px', fontSize: '11.5px' }}
                            onClick={() => setSelectedDocId(documento.id === selectedDocId ? null : documento.id)}
                          >
                            {selectedDocId === documento.id ? 'Ocultar' : 'Ver Línea de Tiempo'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* LADO DERECHO: Detalle de Flujo de Revisión, Línea de Tiempo y Descarga de Actas */}
        {selectedDoc && (() => {
          const tipoDoc = tiposDocumento.find((t) => t.id === selectedDoc.tipoDocumentoId);
          const secciones = tipoDoc?.secciones || [];
          
          // Mapear estado a índice activo
          let activeSectionIndex = 0;
          if (selectedDoc.estado === 'estratificacion') activeSectionIndex = 1;
          else if (selectedDoc.estado === 'revision-tecnica') activeSectionIndex = 2;
          else if (selectedDoc.estado === 'aprobada' || selectedDoc.estado === 'anulada') activeSectionIndex = -1; // Todas completadas

          const devolucionesCount = getDevolucionesCount(selectedDoc);

          return (
            <div
              className="card"
              style={{
                padding: '20px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                animation: 'slideIn 0.2s ease-out',
                maxHeight: '85vh',
                overflowY: 'auto'
              }}
            >
              {/* Encabezado del Detalle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>Seguimiento de Flujo</h3>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{selectedDoc.codigo}</span>
                </div>
                <button
                  onClick={() => setSelectedDocId(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              {/* Tarjeta de Datos Rápidos */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Tema del Proyecto</p>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1e293b', fontWeight: 700, lineHeight: '1.4' }}>{selectedDoc.tema}</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
                  {getEstadoBadge(selectedDoc.estado)}
                  <span style={{ fontSize: '11px', color: '#854d0e', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                    ↩ Devoluciones: {devolucionesCount}
                  </span>
                </div>
              </div>

              {/* LÍNEA DE TIEMPO VISUAL */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Línea de Tiempo</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '20px', borderLeft: '2.5px solid #e2e8f0', marginLeft: '8px' }}>
                  {secciones.map((sec, idx) => {
                    const { entrada, salida } = getEtapaFechas(selectedDoc, idx);
                    const devolucionesEtapa = getDevolucionesEtapa(selectedDoc, idx);
                    
                    // Determinar estado de la etapa (verde = completada, naranja = actual, gris = pendiente)
                    let status: 'completed' | 'current' | 'pending' = 'pending';
                    if (activeSectionIndex === -1 || idx < activeSectionIndex) {
                      status = 'completed';
                    } else if (idx === activeSectionIndex) {
                      status = 'current';
                    }

                    // Colores de la línea de tiempo
                    const colorMap = {
                      completed: { bg: '#10b981', border: '#10b981', text: '#047857', badgeBg: '#d1fae5' },
                      current: { bg: '#f97316', border: '#f97316', text: '#c2410c', badgeBg: '#ffedd5' },
                      pending: { bg: '#94a3b8', border: '#cbd5e1', text: '#475569', badgeBg: '#f1f5f9' },
                    };

                    const colors = colorMap[status];

                    return (
                      <div key={sec.id} style={{ position: 'relative', marginBottom: '4px' }}>
                        {/* Círculo indicador de estado */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '-27px',
                            top: '3px',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: colors.bg,
                            border: '3px solid white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        />

                        {/* Título de la Etapa */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: colors.text }}>
                            {sec.nombre}
                          </span>
                          <span style={{ fontSize: '9.5px', color: colors.text, background: colors.badgeBg, padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {status === 'completed' ? 'Completado' : status === 'current' ? 'En Curso' : 'Pendiente'}
                          </span>
                        </div>

                        {/* Fechas de Entrada y Salida */}
                        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                          {entrada && (
                            <span>
                              🟢 Entrada: {new Date(entrada).toLocaleDateString()}
                            </span>
                          )}
                          {salida && (
                            <span>
                              🔴 Salida: {new Date(salida).toLocaleDateString()}
                            </span>
                          )}
                          {devolucionesEtapa > 0 && (
                            <span style={{ color: '#b45309', fontWeight: 600, background: '#fffbeb', padding: '1px 6px', borderRadius: '4px', border: '1px solid #fde68a', fontSize: '9.5px' }}>
                              ↩ Devoluciones: {devolucionesEtapa}
                            </span>
                          )}
                        </div>

                        {/* Listado de Anexos asociados a la etapa */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px', paddingLeft: '8px' }}>
                          {sec.anexos.map((anItem) => {
                            const template = anexosTemplates.find((t) => t.id === anItem.anexoTemplateId);
                            if (!template) return null;

                            // Comprobar si está completado (existe RespuestaAnexo para este anexo)
                            const completado = respuestasAnexos.some(
                              (r) => r.documentoId === selectedDoc.id && r.anexoTemplateId === template.id
                            );

                            return (
                              <div
                                key={anItem.anexoTemplateId}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '11px',
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                }}
                              >
                                <span style={{ color: '#475569', fontWeight: 500 }}>
                                  Anexo {template.numero}: {template.nombre.substring(0, 30)}...
                                </span>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: anItem.obligatorio ? '#fee2e2' : '#f1f5f9', color: anItem.obligatorio ? '#991b1b' : '#475569', fontWeight: 600 }}>
                                    {anItem.obligatorio ? 'Oblig' : 'Opc'}
                                  </span>
                                  {completado ? (
                                    <span style={{ fontSize: '9.5px', color: '#16a34a', fontWeight: 700 }}>✓ Listo</span>
                                  ) : (
                                    <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 500 }}>Pendiente</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECCIÓN DE DESCARGA DE ARCHIVOS WORD */}
              <div style={{ borderTop: '1.5px solid #f1f5f9', paddingTop: '14px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '12.5px', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descarga de Anexos Completados</h4>
                <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                  Descargue los anexos diligenciados del proyecto directamente en formato de plantilla oficial de Word (.docx). Las opciones para anexos pendientes están deshabilitadas.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {secciones.flatMap((s) => s.anexos).map((anItem) => {
                    const template = anexosTemplates.find((t) => t.id === anItem.anexoTemplateId);
                    if (!template) return null;

                    const completado = respuestasAnexos.some(
                      (r) => r.documentoId === selectedDoc.id && r.anexoTemplateId === template.id
                    );

                    return (
                      <div
                        key={template.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: completado ? '#f0fdf4' : '#f8fafc',
                          border: `1px solid ${completado ? '#bbf7d0' : '#e2e8f0'}`,
                          padding: '8px 12px',
                          borderRadius: '6px',
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: completado ? '#166534' : '#64748b' }}>
                            Anexo {template.numero}: {template.nombre}
                          </p>
                          <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                            Rol: {template.rol === 'investigador' ? 'Investigador' : 'Evaluador'}
                          </p>
                        </div>

                        <button
                          type="button"
                          className={`eval-btn ${completado ? 'eval-btn--primary' : 'eval-btn--outline'}`}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            cursor: completado ? 'pointer' : 'not-allowed',
                            backgroundColor: completado ? '#2563eb' : '#f1f5f9',
                            color: completado ? 'white' : '#94a3b8',
                            borderColor: completado ? '#2563eb' : '#cbd5e1',
                          }}
                          disabled={!completado}
                          onClick={() => handleDescargarWord(selectedDoc, template)}
                        >
                          {completado ? 'Descargar Word' : 'Pendiente'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
