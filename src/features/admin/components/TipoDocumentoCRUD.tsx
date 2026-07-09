import React, { useState } from 'react';
import { useCeishStore } from '../../../store/ceishStore';
import type { TipoDocumento, AnexoAsignado } from '../../../shared/types/platform.types';

interface SeccionLocal {
  id?: string;
  nombre: string;
  orden: number;
  anexos: AnexoAsignado[];
}

export function TipoDocumentoCRUD() {
  const { 
    tiposDocumento, 
    anexosTemplates, 
    crearTipoDocumento, 
    editarTipoDocumento, 
    eliminarTipoDocumento 
  } = useCeishStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [nombre, setNombre] = useState('');
  const [secciones, setSecciones] = useState<SeccionLocal[]>([]);

  const handleStartCreate = () => {
    setNombre('');
    setSecciones([
      { nombre: 'Etapa 1: Creación', orden: 1, anexos: [] },
      { nombre: 'Etapa 2: Estratificación', orden: 2, anexos: [] },
      { nombre: 'Etapa 3: Evaluación', orden: 3, anexos: [] }
    ]);
    setEditingId(null);
    setIsEditing(true);
  };

  const handleStartEdit = (tipo: TipoDocumento) => {
    setNombre(tipo.nombre);
    setSecciones(tipo.secciones.map(sec => ({
      id: sec.id,
      nombre: sec.nombre,
      orden: sec.orden,
      anexos: sec.anexos.map(an => ({ ...an }))
    })));
    setEditingId(tipo.id);
    setIsEditing(true);
  };

  const handleAddSeccion = () => {
    setSecciones([
      ...secciones,
      {
        nombre: `Etapa ${secciones.length + 1}: Nueva Etapa`,
        orden: secciones.length + 1,
        anexos: []
      }
    ]);
  };

  const handleRemoveSeccion = (index: number) => {
    setSecciones(secciones.filter((_, idx) => idx !== index));
  };

  const handleSeccionNameChange = (index: number, val: string) => {
    const updated = [...secciones];
    updated[index].nombre = val;
    setSecciones(updated);
  };

  const handleMoveSeccion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === secciones.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...secciones];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    // Actualizar orden
    updated.forEach((s, idx) => {
      s.orden = idx + 1;
    });

    setSecciones(updated);
  };

  // Acciones sobre Anexos dentro de la Sección
  const handleAddAnexoToSeccion = (secIdx: number) => {
    if (anexosTemplates.length === 0) {
      return alert('No hay plantillas de anexo creadas aún. Por favor crea una plantilla de anexo primero.');
    }
    const updated = [...secciones];
    updated[secIdx].anexos = [
      ...updated[secIdx].anexos,
      {
        anexoTemplateId: anexosTemplates[0].id,
        obligatorio: true
      }
    ];
    setSecciones(updated);
  };

  const handleRemoveAnexoFromSeccion = (secIdx: number, anIdx: number) => {
    const updated = [...secciones];
    updated[secIdx].anexos = updated[secIdx].anexos.filter((_, idx) => idx !== anIdx);
    setSecciones(updated);
  };

  const handleAnexoChange = (secIdx: number, anIdx: number, field: keyof AnexoAsignado, value: any) => {
    const updated = [...secciones];
    updated[secIdx].anexos[anIdx] = {
      ...updated[secIdx].anexos[anIdx],
      [field]: value
    };
    setSecciones(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return alert('Por favor ingresa el nombre del Tipo de Documento.');
    if (secciones.length === 0) return alert('Debes agregar al menos una sección/etapa.');

    // Validar nombres de sección vacíos
    if (secciones.some(s => !s.nombre.trim())) {
      return alert('Por favor completa el nombre de todas las etapas.');
    }

    if (editingId) {
      editarTipoDocumento(editingId, nombre, secciones);
    } else {
      crearTipoDocumento(nombre, secciones);
    }

    setIsEditing(false);
    setEditingId(null);
  };

  return (
    <div className="admin-crud-panel">
      {!isEditing ? (
        <div className="crud-list-view">
          <div className="crud-list-header">
            <h3>Tipos de Documento Configurados</h3>
            <button className="eval-btn eval-btn--primary" onClick={handleStartCreate}>
              + Crear Tipo Documento
            </button>
          </div>

          <div className="crud-grid">
            {tiposDocumento.length === 0 ? (
              <div className="crud-empty">No hay tipos de documento creados. Presiona "+ Crear Tipo Documento" para empezar.</div>
            ) : (
              tiposDocumento.map(tipo => (
                <div key={tipo.id} className="crud-card">
                  <div className="crud-card__header">
                    <span className="crud-card__badge">Configurable</span>
                  </div>
                  <h4 className="crud-card__title">{tipo.nombre}</h4>
                  <p className="crud-card__desc">
                    {tipo.secciones.length} etapas, {tipo.secciones.reduce((acc, s) => acc + s.anexos.length, 0)} anexos en total
                  </p>
                  <div className="crud-card__actions">
                    <button className="eval-btn eval-btn--sm eval-btn--outline" onClick={() => handleStartEdit(tipo)}>
                      Editar Configuración
                    </button>
                    <button 
                      className="eval-btn eval-btn--sm eval-btn--danger" 
                      onClick={() => {
                        if (confirm(`¿Estás seguro de que deseas eliminar el Tipo de Documento "${tipo.nombre}"? Esto invalidará nuevos registros de este tipo.`)) {
                          eliminarTipoDocumento(tipo.id);
                        }
                      }}
                      disabled={tipo.id === 'tipo-investigacion'} // Bloquear borrado del seed core de prueba
                      title={tipo.id === 'tipo-investigacion' ? 'El seed básico de Investigación no puede eliminarse' : ''}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <form className="crud-form" onSubmit={handleSave}>
          <div className="crud-form-header">
            <h3>{editingId ? 'Editar Tipo de Documento' : 'Crear Tipo de Documento'}</h3>
            <div className="crud-form-actions">
              <button type="button" className="eval-btn eval-btn--outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </button>
              <button type="submit" className="eval-btn eval-btn--primary">
                Guardar Configuración
              </button>
            </div>
          </div>

          <div className="crud-form-grid">
            <div className="form-group full-width">
              <label className="form-label">Nombre del Tipo de Documento</label>
              <input 
                type="text" 
                className="form-input" 
                value={nombre} 
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Tesis Doctoral, Artículo de Revista"
                required
              />
            </div>
          </div>

          <div className="crud-sections-manager">
            <div className="sections-header">
              <h4>Estructura de Secciones / Etapas</h4>
              <button type="button" className="eval-btn eval-btn--sm eval-btn--outline" onClick={handleAddSeccion}>
                + Agregar Etapa
              </button>
            </div>

            <div className="sections-list">
              {secciones.length === 0 ? (
                <div className="sections-empty">No hay etapas configuradas. Agrega al menos una etapa para este flujo.</div>
              ) : (
                secciones.map((seccion, secIdx) => (
                  <div key={secIdx} className="section-editor-card">
                    <div className="section-card__header">
                      <div className="section-card__title-row">
                        <span className="section-order-badge">Etapa {seccion.orden}</span>
                        <input 
                          type="text"
                          className="form-input form-input--inline"
                          value={seccion.nombre}
                          onChange={(e) => handleSeccionNameChange(secIdx, e.target.value)}
                          placeholder="Nombre de la Etapa (Ej: Estratificación de Riesgos)"
                          required
                        />
                      </div>

                      <div className="section-card__header-actions">
                        <button 
                          type="button" 
                          className="order-btn" 
                          onClick={() => handleMoveSeccion(secIdx, 'up')}
                          disabled={secIdx === 0}
                        >
                          ▲
                        </button>
                        <button 
                          type="button" 
                          className="order-btn" 
                          onClick={() => handleMoveSeccion(secIdx, 'down')}
                          disabled={secIdx === secciones.length - 1}
                        >
                          ▼
                        </button>
                        <button 
                          type="button" 
                          className="eval-btn eval-btn--sm eval-btn--danger" 
                          onClick={() => handleRemoveSeccion(secIdx)}
                        >
                          Eliminar Etapa
                        </button>
                      </div>
                    </div>

                    <div className="section-card__body">
                      <div className="assigned-anexos-header">
                        <h5>Anexos Asociados a esta Etapa</h5>
                        <button 
                          type="button" 
                          className="eval-btn eval-btn--sm eval-btn--outline" 
                          onClick={() => handleAddAnexoToSeccion(secIdx)}
                        >
                          + Asociar Anexo
                        </button>
                      </div>

                      <div className="assigned-anexos-list">
                        {seccion.anexos.length === 0 ? (
                          <div className="anexos-empty">Ningún anexo asociado a esta etapa. Debes asociar al menos uno.</div>
                        ) : (
                          seccion.anexos.map((anexo, anIdx) => (
                            <div key={anIdx} className="assigned-anexo-row">
                              <select 
                                className="form-input"
                                value={anexo.anexoTemplateId}
                                onChange={(e) => handleAnexoChange(secIdx, anIdx, 'anexoTemplateId', e.target.value)}
                              >
                                {anexosTemplates.map(t => (
                                  <option key={t.id} value={t.id}>
                                    Anexo {t.numero} - {t.nombre} ({t.rol === 'investigador' ? 'Investigador' : 'Evaluador'})
                                  </option>
                                ))}
                              </select>

                              <label className="checkbox-label">
                                <input 
                                  type="checkbox" 
                                  checked={anexo.obligatorio}
                                  onChange={(e) => handleAnexoChange(secIdx, anIdx, 'obligatorio', e.target.checked)}
                                />
                                <span>Obligatorio</span>
                              </label>

                              <button 
                                type="button" 
                                className="order-btn order-btn--danger"
                                onClick={() => handleRemoveAnexoFromSeccion(secIdx, anIdx)}
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
