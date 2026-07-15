import { useRef, useState, useEffect } from 'react';
import { useCeishStore } from '../../../store/ceishStore';
import { ceishFileCache } from '../../../store/fileCache';
import type { Autor, ValorCampo } from '../../../shared/types/platform.types';
import '../../student/student.css';

interface Props {
  onCancel: () => void;
  investigadorId: string;
  investigadorNombre: string;
}

// Usuarios registrados simulados en la base de datos (con cédula para autocompletado)
const USUARIOS_REGISTRADOS = [
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Juan Pérez', cedula: 'c0000000-0000-0000-0000-000000000001', role: 'student' },
  { id: 'c0000000-0000-0000-0000-000000000002', name: 'María López', cedula: 'c0000000-0000-0000-0000-000000000002', role: 'student' },
  { id: 'b0000000-0000-0000-0000-000000000001', name: 'Profesor Demo', cedula: 'b0000000-0000-0000-0000-000000000001', role: 'evaluator', cargo: 'Presidente del Comité' },
  { id: 'b0000000-0000-0000-0000-000000000002', name: 'Evaluador Alterno CEISH', cedula: 'b0000000-0000-0000-0000-000000000002', role: 'evaluator', cargo: 'Secretario CEISH' },
  { id: 'b0000000-0000-0000-0000-000000000003', name: 'Dr. Roberto Anchundia', cedula: 'b0000000-0000-0000-0000-000000000003', role: 'evaluator', cargo: 'Vocal Técnico' },
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Coordinador Admin', cedula: 'a0000000-0000-0000-0000-000000000001', role: 'admin' }
];

export function CrearInvestigacionModal({ onCancel, investigadorId, investigadorNombre }: Props) {
  const { crearDocumento, tiposDocumento, anexosTemplates, guardarRespuestaAnexo } = useCeishStore();

  const [selectedTipoDocId, setSelectedTipoDocId] = useState('');
  const [tema, setTema] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [autores, setAutores] = useState<Autor[]>([]); 
  const [riesgo] = useState<'sin-riesgo' | 'riesgo-minimo' | 'riesgo-mayor'>('sin-riesgo');
  const [conflictos] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados para el llenado dinámico de anexos en el wizard de creación (Etapa 1)
  const [activeAnexoId, setActiveAnexoId] = useState<string | null>(null);
  const [respuestasForm, setRespuestasForm] = useState<Record<string, Record<string, any>>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Obtener la sección de creación (Etapa 1) para el tipo de documento seleccionado
  const tipoDocSeleccionado = tiposDocumento.find(t => t.id === selectedTipoDocId);
  const etapaCreacion = tipoDocSeleccionado?.secciones[0];

  // Autoseleccionar el primer anexo al cambiar el tipo de documento
  useEffect(() => {
    if (etapaCreacion && etapaCreacion.anexos.length > 0) {
      setActiveAnexoId(etapaCreacion.anexos[0].anexoTemplateId);
    } else {
      setActiveAnexoId(null);
    }
  }, [selectedTipoDocId, etapaCreacion]);

  // Manejar adición de autores
  const addAutorField = () => setAutores([...autores, { cedula: '', nombre: '' }]);
  
  const removeAutorField = (index: number) => {
    setAutores(autores.filter((_, i) => i !== index));
  };

  const handleCedulaChange = (index: number, cedulaVal: string) => {
    const updated = [...autores];
    const matched = USUARIOS_REGISTRADOS.find(u => u.cedula === cedulaVal.trim());
    updated[index] = {
      cedula: cedulaVal,
      nombre: matched ? matched.name : ''
    };
    setAutores(updated);
  };

  const handleNombreChange = (index: number, nombreVal: string) => {
    const updated = [...autores];
    const matched = USUARIOS_REGISTRADOS.find(u => u.cedula === updated[index].cedula.trim());
    if (!matched) {
      updated[index].nombre = nombreVal;
      setAutores(updated);
    }
  };


  // Manejar llenado de respuestas locales en el wizard
  const handlePreguntaChange = (anexoId: string, preguntaId: string, valor: any) => {
    setRespuestasForm(prev => ({
      ...prev,
      [anexoId]: {
        ...(prev[anexoId] || {}),
        [preguntaId]: valor
      }
    }));
  };

  const validateAndSetFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se permiten archivos en formato PDF.');
      setFile(null);
      return;
    }
    const maxBytes = 15 * 1024 * 1024;
    if (f.size > maxBytes) {
      setError('El archivo supera el límite de 15 MB.');
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    validateAndSetFile(f);
  };

  // Determinar si un anexo de Etapa 1 está completamente lleno
  const isAnexoCompleto = (anexoId: string) => {
    const template = anexosTemplates.find(t => t.id === anexoId);
    if (!template) return false;
    const ans = respuestasForm[anexoId] || {};
    return template.preguntas.every(p => {
      const v = ans[p.id];
      if (v === undefined || v === null || v === '') return false;
      return true;
    });
  };

  // Determinar si la Etapa 1 está completa
  const isEtapa1Completa = () => {
    if (!etapaCreacion) return false;
    return etapaCreacion.anexos
      .filter(an => an.obligatorio)
      .every(an => isAnexoCompleto(an.anexoTemplateId));
  };

  const getAnexosPendientesNombres = () => {
    if (!etapaCreacion) return [];
    return etapaCreacion.anexos
      .filter(an => an.obligatorio && !isAnexoCompleto(an.anexoTemplateId))
      .map(an => {
        const temp = anexosTemplates.find(t => t.id === an.anexoTemplateId);
        return temp ? `Anexo ${temp.numero}` : 'Anexo';
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTipoDocId || !tema.trim() || !descripcion.trim() || !file) {
      setError('Por favor complete todos los campos obligatorios y suba el archivo PDF.');
      return;
    }

    if (!isEtapa1Completa()) {
      setError(`Falta rellenar los anexos obligatorios: ${getAnexosPendientesNombres().join(', ')}`);
      return;
    }

    const coAutoresFiltrados = autores.filter(a => a.cedula.trim() !== '');
    const listaAutores: Autor[] = [
      { cedula: investigadorId, nombre: investigadorNombre },
      ...coAutoresFiltrados
    ];

    const conflictosDeclarados = [...conflictos];
    listaAutores.forEach(autor => {
      const matchEvaluador = USUARIOS_REGISTRADOS.find(u => u.cedula === autor.cedula && u.role === 'evaluator');
      if (matchEvaluador && !conflictosDeclarados.includes(matchEvaluador.id)) {
        conflictosDeclarados.push(matchEvaluador.id);
      }
    });

    const docId = 'doc-' + Date.now();
    const fileId = 'ver-' + Date.now();
    ceishFileCache[fileId] = file;

    // 1. Crear documento principal
    crearDocumento(
      selectedTipoDocId,
      tema.trim(),
      descripcion.trim(),
      listaAutores,
      riesgo,
      conflictosDeclarados,
      investigadorId,
      investigadorNombre,
      file.name,
      fileId,
      docId,
      fileId
    );

    // 2. Guardar respuestas de los anexos completados
    if (etapaCreacion) {
      etapaCreacion.anexos.forEach(an => {
        const answers = respuestasForm[an.anexoTemplateId];
        if (answers) {
          const valores: ValorCampo[] = Object.keys(answers).map(pregId => ({
            campoId: pregId,
            valor: answers[pregId]
          }));

          guardarRespuestaAnexo({
            anexoTemplateId: an.anexoTemplateId,
            documentoId: docId,
            seccionId: etapaCreacion.id,
            versionArchivoId: fileId,
            emitidoPorId: investigadorId,
            emitidoPorNombre: investigadorNombre,
            valores,
            comentariosAnotados: []
          });
        }
      });
    }



    window.alert('Trámite registrado y enviado exitosamente. Se asignó automáticamente un revisor de forma ciega.');
    onCancel();
  };


  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" style={{ maxWidth: '850px', width: '90%' }}>
        <div className="modal__header">
          <h2 className="modal__title">Registrar Nuevo Proyecto de Investigación</h2>
          <button className="modal__close" onClick={onCancel} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body" style={{ maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Selección de Tipo de Documento */}
            <div className="modal__field">
              <label className="modal__label">Tipo de Trámite / Flujo *</label>
              <select
                className="modal__input"
                required
                value={selectedTipoDocId}
                onChange={(e) => setSelectedTipoDocId(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
              >
                <option value="">-- Seleccione un Flujo Configurado --</option>
                {tiposDocumento.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>

            {selectedTipoDocId && (
              <>
                {/* Metadatos Generales */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="modal__field">
                    <label className="modal__label">Tema / Título de la Investigación *</label>
                    <input
                      type="text"
                      className="modal__input"
                      required
                      placeholder="Ej: Impacto ambiental en la cuenca..."
                      value={tema}
                      onChange={(e) => setTema(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                  </div>

                  <div className="modal__field">
                    <label className="modal__label">Resumen / Descripción del Proyecto *</label>
                    <textarea
                      className="modal__textarea"
                      required
                      placeholder="Describa brevemente los objetivos..."
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'vertical' }}
                    />
                  </div>
                </div>

                {/* Co-autores por Cédula */}
                <div className="modal__field">
                  <label className="modal__label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Co-autores / Colaboradores</span>
                    <button
                      type="button"
                      className="eval-btn eval-btn--outline"
                      style={{ padding: '2px 8px', fontSize: '12px' }}
                      onClick={addAutorField}
                    >
                      + Agregar Co-autor
                    </button>
                  </label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                    {autores.map((autor, idx) => {
                      const match = USUARIOS_REGISTRADOS.find(u => u.cedula === autor.cedula.trim());
                      return (
                        <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#f8fafc', padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <input
                            type="text"
                            placeholder="Cédula"
                            required
                            value={autor.cedula}
                            onChange={(e) => handleCedulaChange(idx, e.target.value)}
                            style={{ width: '100px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                          />
                          <input
                            type="text"
                            placeholder="Nombre"
                            disabled={!!match}
                            value={match ? match.name : autor.nombre}
                            onChange={(e) => handleNombreChange(idx, e.target.value)}
                            style={{ flex: 1, padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: match ? '#e2e8f0' : 'white' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeAutorField(idx)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>


                {/* PDF Upload */}
                <div className="modal__field">
                  <label className="modal__label">Protocolo de Investigación (PDF) *</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: file ? '#eff6ff' : '#f8fafc'
                    }}
                  >
                    {file ? (
                      <p style={{ margin: 0, fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>
                        ✓ {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                        + Seleccionar archivo PDF (Máx. 15 MB)
                      </p>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* WIZARD DINÁMICO DE ANEXOS ETAPA 1 */}
                {etapaCreacion && etapaCreacion.anexos.length > 0 && (
                  <div style={{ borderTop: '1.5px solid #cbd5e1', paddingTop: '16px', marginTop: '6px' }}>
                    <h3 style={{ fontSize: '14px', margin: '0 0 10px 0', color: '#0f172a', fontWeight: 700 }}>
                      Formularios Obligatorios de Inicio (Etapa 1: {etapaCreacion.nombre})
                    </h3>

                    {/* Barrita superior de pestañas */}
                    <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '12px' }}>
                      {etapaCreacion.anexos.map(an => {
                        const temp = anexosTemplates.find(t => t.id === an.anexoTemplateId);
                        if (!temp) return null;
                        const compl = isAnexoCompleto(temp.id);

                        return (
                          <button
                            key={temp.id}
                            type="button"
                            onClick={() => setActiveAnexoId(temp.id)}
                            style={{
                              padding: '6px 10px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: activeAnexoId === temp.id ? '#2563eb' : '#cbd5e1',
                              background: activeAnexoId === temp.id ? '#eff6ff' : 'white',
                              color: activeAnexoId === temp.id ? '#2563eb' : '#334155',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            Anexo {temp.numero}
                            <span>{compl ? '✅' : '⏳'}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Contenido del Anexo Activo */}
                    {activeAnexoId && (() => {
                      const template = anexosTemplates.find(t => t.id === activeAnexoId);
                      if (!template) return null;

                      return (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <h4 style={{ margin: 0, fontSize: '13px', color: '#1e293b', fontWeight: 700 }}>
                            Anexo {template.numero}: {template.nombre}
                          </h4>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {template.preguntas.map(p => {
                              const currentVal = (respuestasForm[template.id] || {})[p.id];
                              return (
                                <div key={p.id} className="form-group" style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  {p.descripcionContexto && (
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px', display: 'block' }}>
                                      [{p.descripcionContexto}]
                                    </span>
                                  )}
                                  <label className="form-label" style={{ fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>{p.texto}</label>

                                  {p.tipo === 'texto-libre' ? (
                                    <textarea
                                      className="form-input"
                                      value={currentVal || ''}
                                      onChange={(e) => handlePreguntaChange(template.id, p.id, e.target.value)}
                                      rows={2}
                                      style={{ fontSize: '12.5px' }}
                                      required
                                    />
                                  ) : p.tipo === 'archivo' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      <input
                                        type="file"
                                        accept=".pdf,application/pdf,image/*"
                                        onChange={(e) => {
                                          const f = e.target.files?.[0] || null;
                                          if (!f) return;
                                          const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
                                          const isImage = f.type.startsWith('image/');
                                          if (!isPdf && !isImage) {
                                            window.alert('Solo se permiten archivos en formato PDF o imagen.');
                                            return;
                                          }
                                          const fileKey = `preg-archivo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                                          ceishFileCache[fileKey] = f;
                                          handlePreguntaChange(template.id, p.id, { documentName: f.name, documentPath: fileKey });
                                        }}
                                        style={{ fontSize: '12px' }}
                                      />
                                      {currentVal?.documentName && (
                                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                                          ✓ Archivo adjunto: {currentVal.documentName}
                                        </span>
                                      )}
                                    </div>
                                  ) : p.tipo === 'si-no' ? (
                                     <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                                       <button
                                         type="button"
                                         onClick={() => handlePreguntaChange(template.id, p.id, 'SI')}
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
                                         onClick={() => handlePreguntaChange(template.id, p.id, 'NO')}
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
                                  ) : (
                                    <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={!!currentVal}
                                        onChange={(e) => handlePreguntaChange(template.id, p.id, e.target.checked)}
                                      />
                                      <span style={{ fontSize: '12px' }}>Marcar conformidad</span>
                                    </label>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
                {error}
              </div>
            )}
          </div>

          <div className="modal__footer">
            <button type="button" className="eval-btn eval-btn--outline" onClick={onCancel}>Cancelar</button>
            
            {selectedTipoDocId && (
              <button
                type="submit"
                className="eval-btn eval-btn--primary"
                disabled={!tema.trim() || !descripcion.trim() || !file || !isEtapa1Completa()}
                style={{
                  opacity: (!tema.trim() || !descripcion.trim() || !file || !isEtapa1Completa()) ? 0.5 : 1,
                  cursor: (!tema.trim() || !descripcion.trim() || !file || !isEtapa1Completa()) ? 'not-allowed' : 'pointer'
                }}
              >
                Registrar Proyecto y Solicitar Revisión
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
