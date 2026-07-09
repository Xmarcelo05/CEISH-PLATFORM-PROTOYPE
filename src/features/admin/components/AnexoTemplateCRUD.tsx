import React, { useState } from 'react';
import { useCeishStore } from '../../../store/ceishStore';
import type { AnexoTemplate, Pregunta, CampoTipo } from '../../../shared/types/platform.types';

export function AnexoTemplateCRUD() {
  const { 
    anexosTemplates, 
    crearAnexoTemplate, 
    editarAnexoTemplate, 
    eliminarAnexoTemplate 
  } = useCeishStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [numero, setNumero] = useState<number>(1);
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<'investigador' | 'evaluador'>('investigador');
  const [preguntas, setPreguntas] = useState<(Omit<Pregunta, 'id'> & { id?: string })[]>([]);

  const handleStartCreate = () => {
    setNumero(anexosTemplates.length + 1);
    setNombre('');
    setRol('investigador');
    setPreguntas([]);
    setEditingId(null);
    setIsEditing(true);
  };

  const handleStartEdit = (template: AnexoTemplate) => {
    setNumero(template.numero);
    setNombre(template.nombre);
    setRol(template.rol);
    // Clonamos las preguntas para no editar el store directamente
    setPreguntas(template.preguntas.map(p => ({ ...p })));
    setEditingId(template.id);
    setIsEditing(true);
  };

  const handleAddPregunta = () => {
    setPreguntas([
      ...preguntas,
      {
        texto: '',
        tipo: 'cumple-nocumple', // Por defecto
        descripcionContexto: '',
        orden: preguntas.length + 1
      }
    ]);
  };

  const handleRemovePregunta = (index: number) => {
    setPreguntas(preguntas.filter((_, idx) => idx !== index));
  };

  const handlePreguntaChange = (index: number, field: keyof Pregunta, value: any) => {
    const updated = [...preguntas];
    updated[index] = { ...updated[index], [field]: value };
    setPreguntas(updated);
  };

  const handleMovePregunta = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === preguntas.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...preguntas];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    // Actualizar orden
    updated.forEach((p, idx) => {
      p.orden = idx + 1;
    });

    setPreguntas(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return alert('Por favor, ingresa el nombre de la plantilla.');
    if (preguntas.length === 0) return alert('Debes agregar al menos una pregunta a la plantilla.');

    // Validar preguntas vacías
    const vacia = preguntas.some(p => !p.texto.trim());
    if (vacia) return alert('Por favor, completa el texto de todas las preguntas.');

    if (editingId) {
      editarAnexoTemplate(editingId, numero, nombre, rol, preguntas);
    } else {
      crearAnexoTemplate(numero, nombre, rol, preguntas);
    }

    setIsEditing(false);
    setEditingId(null);
  };

  return (
    <div className="admin-crud-panel">
      {!isEditing ? (
        <div className="crud-list-view">
          <div className="crud-list-header">
            <h3>Plantillas de Anexo</h3>
            <button className="eval-btn eval-btn--primary" onClick={handleStartCreate}>
              + Crear Plantilla
            </button>
          </div>

          <div className="crud-grid">
            {anexosTemplates.length === 0 ? (
              <div className="crud-empty">No hay plantillas de anexo creadas. Presiona "+ Crear Plantilla" para empezar.</div>
            ) : (
              anexosTemplates
                .sort((a, b) => a.numero - b.numero)
                .map(template => (
                  <div key={template.id} className="crud-card">
                    <div className="crud-card__header">
                      <span className="crud-card__badge">Anexo {template.numero}</span>
                      <span className={`badge ${template.rol === 'investigador' ? 'badge--neutral' : 'badge--info'}`}>
                        {template.rol === 'investigador' ? 'Investigador' : 'Revisor/Evaluador'}
                      </span>
                    </div>
                    <h4 className="crud-card__title">{template.nombre}</h4>
                    <p className="crud-card__desc">{template.preguntas.length} preguntas configuradas</p>
                    <div className="crud-card__actions">
                      <button className="eval-btn eval-btn--sm eval-btn--outline" onClick={() => handleStartEdit(template)}>
                        Editar
                      </button>
                      <button 
                        className="eval-btn eval-btn--sm eval-btn--danger" 
                        onClick={() => {
                          if (confirm(`¿Estás seguro de que deseas eliminar el Anexo ${template.numero}? Se desvinculará de las secciones en uso.`)) {
                            eliminarAnexoTemplate(template.id);
                          }
                        }}
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
            <h3>{editingId ? 'Editar Plantilla de Anexo' : 'Crear Plantilla de Anexo'}</h3>
            <div className="crud-form-actions">
              <button type="button" className="eval-btn eval-btn--outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </button>
              <button type="submit" className="eval-btn eval-btn--primary">
                Guardar
              </button>
            </div>
          </div>

          <div className="crud-form-grid">
            <div className="form-group">
              <label className="form-label">Número de Anexo</label>
              <input 
                type="number" 
                className="form-input" 
                value={numero} 
                onChange={(e) => setNumero(Number(e.target.value))}
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nombre del Anexo</label>
              <input 
                type="text" 
                className="form-input" 
                value={nombre} 
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Ficha de Compromiso Ético"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Rol del Ejecutor (Quién lo llena)</label>
              <select 
                className="form-input" 
                value={rol} 
                onChange={(e) => setRol(e.target.value as 'investigador' | 'evaluador')}
              >
                <option value="investigador">Investigador</option>
                <option value="evaluador">Revisor / Evaluador</option>
              </select>
            </div>
          </div>

          <div className="crud-questions-section">
            <div className="questions-header">
              <h4>Preguntas / Criterios de la Plantilla</h4>
              <button type="button" className="eval-btn eval-btn--sm eval-btn--outline" onClick={handleAddPregunta}>
                + Agregar Pregunta
              </button>
            </div>

            <div className="questions-list">
              {preguntas.length === 0 ? (
                <div className="questions-empty">No hay preguntas agregadas aún. Añade al menos una.</div>
              ) : (
                preguntas.map((pregunta, idx) => (
                  <div key={idx} className="question-editor-card">
                    <div className="question-card__left">
                      <span className="question-number">#{idx + 1}</span>
                      <div className="question-order-buttons">
                        <button 
                          type="button" 
                          className="order-btn" 
                          onClick={() => handleMovePregunta(idx, 'up')}
                          disabled={idx === 0}
                        >
                          ▲
                        </button>
                        <button 
                          type="button" 
                          className="order-btn" 
                          onClick={() => handleMovePregunta(idx, 'down')}
                          disabled={idx === preguntas.length - 1}
                        >
                          ▼
                        </button>
                      </div>
                    </div>

                    <div className="question-card__body">
                      <div className="form-group">
                        <label className="form-label">Texto de la Pregunta</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={pregunta.texto}
                          onChange={(e) => handlePreguntaChange(idx, 'texto', e.target.value)}
                          placeholder="Ej: ¿Involucra investigación en seres humanos?"
                          required
                        />
                      </div>

                      <div className="form-row">
                        <div className="form-group flex-1">
                          <label className="form-label">Tipo de Campo</label>
                          <select 
                            className="form-input"
                            value={pregunta.tipo}
                            onChange={(e) => handlePreguntaChange(idx, 'tipo', e.target.value as CampoTipo)}
                          >
                            <option value="cumple-nocumple">Cumple / No Cumple (Si/No)</option>
                            <option value="texto-libre">Respuesta Abierta (Texto)</option>
                            <option value="si-no">Sí / No</option>
                            <option value="checklist">Checklist</option>
                          </select>
                        </div>

                        <div className="form-group flex-1">
                          <label className="form-label">Contexto / Tema (Opcional)</label>
                          <input 
                            type="text" 
                            className="form-input"
                            value={pregunta.descripcionContexto || ''}
                            onChange={(e) => handlePreguntaChange(idx, 'descripcionContexto', e.target.value)}
                            placeholder="Ej: Aspectos Metodológicos"
                          />
                        </div>
                      </div>
                    </div>

                    <button 
                      type="button" 
                      className="question-card__delete" 
                      onClick={() => handleRemovePregunta(idx)}
                    >
                      ✕
                    </button>
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
