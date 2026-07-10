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
  const [wordTemplateName, setWordTemplateName] = useState<string>('');
  const [wordTemplateBase64, setWordTemplateBase64] = useState<string>('');

  const handleStartCreate = () => {
    setNumero(anexosTemplates.length + 1);
    setNombre('');
    setRol('investigador');
    setPreguntas([]);
    setWordTemplateName('');
    setWordTemplateBase64('');
    setEditingId(null);
    setIsEditing(true);
  };

  const handleStartEdit = (template: AnexoTemplate) => {
    setNumero(template.numero);
    setNombre(template.nombre);
    setRol(template.rol);
    setPreguntas(template.preguntas.map(p => ({ ...p })));
    setWordTemplateName(template.wordTemplateName || '');
    setWordTemplateBase64(template.wordTemplateBase64 || '');
    setEditingId(template.id);
    setIsEditing(true);
  };

  const handleAddPregunta = () => {
    const nextIdx = preguntas.length + 1;
    setPreguntas([
      ...preguntas,
      {
        texto: '',
        tipo: 'checklist',
        descripcionContexto: '',
        orden: nextIdx,
        key: `variable_${nextIdx}`
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.docx')) {
        alert('Solo se permiten archivos de Word (.docx)');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64 = result.split(',')[1]; // Remover el prefijo data:...base64,
        setWordTemplateName(file.name);
        setWordTemplateBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return alert('Por favor, ingresa el nombre de la plantilla.');
    if (preguntas.length === 0) return alert('Debes agregar al menos un campo/variable para rellenar en el documento.');

    // Validar preguntas vacías
    const vacia = preguntas.some(p => !p.texto.trim() || !p.key?.trim());
    if (vacia) return alert('Por favor, completa la etiqueta del campo y el tag de Word para todas las variables.');

    if (editingId) {
      editarAnexoTemplate(editingId, numero, nombre, rol, preguntas, wordTemplateName, wordTemplateBase64);
    } else {
      crearAnexoTemplate(numero, nombre, rol, preguntas, wordTemplateName, wordTemplateBase64);
    }

    setIsEditing(false);
    setEditingId(null);
  };

  return (
    <div className="admin-crud-panel">
      {!isEditing ? (
        <div className="crud-list-view">
          <div className="crud-list-header">
            <h3>Plantillas de Anexo (Plantillas Word)</h3>
            <button className="eval-btn eval-btn--primary" onClick={handleStartCreate}>
              + Crear Plantilla Word
            </button>
          </div>

          <div className="crud-grid">
            {anexosTemplates.length === 0 ? (
              <div className="crud-empty">No hay plantillas creadas. Presiona "+ Crear Plantilla Word" para empezar.</div>
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
                    <p className="crud-card__desc" style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      {template.wordTemplateName ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>
                          📝 Documento: {template.wordTemplateName}
                        </span>
                      ) : (
                        <span style={{ color: '#dc2626' }}>⚠️ Sin archivo Word asociado</span>
                      )}
                    </p>
                    <p className="crud-card__desc" style={{ marginTop: '8px' }}>
                      {template.preguntas.length} variables definidas
                    </p>
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

            <div className="form-group">
              <label className="form-label">Plantilla de Word Oficial (.docx)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <input 
                  type="file" 
                  accept=".docx"
                  onChange={handleFileChange}
                  className="form-input"
                  style={{ fontSize: '12px' }}
                />
                {wordTemplateName && (
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ✓ Subido: {wordTemplateName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="crud-questions-section">
            <div className="questions-header">
              <h4>Variables / Campos de Entrada de la Plantilla</h4>
              <button type="button" className="eval-btn eval-btn--sm eval-btn--outline" onClick={handleAddPregunta}>
                + Agregar Variable/Campo
              </button>
            </div>

            <div className="questions-list">
              {preguntas.length === 0 ? (
                <div className="questions-empty">No hay variables definidas aún. Añade al menos una.</div>
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
                      <div className="form-row">
                        <div className="form-group flex-2">
                          <label className="form-label">Etiqueta del Campo (UI del Formulario)</label>
                          <input 
                            type="text" 
                            className="form-input"
                            value={pregunta.texto}
                            onChange={(e) => handlePreguntaChange(idx, 'texto', e.target.value)}
                            placeholder="Ej: Nombre Completo del Evaluador"
                            required
                          />
                        </div>

                        <div className="form-group flex-1">
                          <label className="form-label">Tag de Word (Ej: {'{tag}'})</label>
                          <input 
                            type="text" 
                            className="form-input"
                            value={pregunta.key || ''}
                            onChange={(e) => handlePreguntaChange(idx, 'key', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                            placeholder="Ej: nombre_evaluador"
                            required
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group flex-1">
                          <label className="form-label">Tipo de Entrada</label>
                          <select 
                            className="form-input"
                            value={pregunta.tipo}
                            onChange={(e) => handlePreguntaChange(idx, 'tipo', e.target.value as CampoTipo)}
                          >
                            <option value="checklist">Checkbox de Conformidad</option>
                            <option value="texto-libre">Respuesta Abierta (Texto)</option>
                            <option value="archivo">Adjuntar Archivo (Imagen o PDF)</option>
                          </select>
                        </div>

                        <div className="form-group flex-1">
                          <label className="form-label">Contexto / Sección (Opcional)</label>
                          <input 
                            type="text" 
                            className="form-input"
                            value={pregunta.descripcionContexto || ''}
                            onChange={(e) => handlePreguntaChange(idx, 'descripcionContexto', e.target.value)}
                            placeholder="Ej: Sección 1: Datos Generales"
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
