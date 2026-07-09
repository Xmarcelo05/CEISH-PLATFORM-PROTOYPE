import { useRef, useState } from 'react';
import { useCeishStore } from '../../../store/ceishStore';
import { ceishFileCache } from '../../../store/fileCache';
import type { Autor } from '../../../shared/types/platform.types';
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
  const { crearDocumento } = useCeishStore();

  const [tema, setTema] = useState('');
  const [descripcion, setDescripcion] = useState('');
  // Autores ahora guardan un arreglo de objetos Autor (cédula, nombre)
  const [autores, setAutores] = useState<Autor[]>([]); 
  const [riesgo, setRiesgo] = useState<'sin-riesgo' | 'riesgo-minimo' | 'riesgo-mayor'>('sin-riesgo');
  const [conflictos, setConflictos] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manejar adición de autores
  const addAutorField = () => setAutores([...autores, { cedula: '', nombre: '' }]);
  
  const removeAutorField = (index: number) => {
    setAutores(autores.filter((_, i) => i !== index));
  };

  const handleCedulaChange = (index: number, cedulaVal: string) => {
    const updated = [...autores];
    // Cruzar contra base de datos registrada para autocompletar nombre
    const matched = USUARIOS_REGISTRADOS.find(u => u.cedula === cedulaVal.trim());
    updated[index] = {
      cedula: cedulaVal,
      nombre: matched ? matched.name : ''
    };
    setAutores(updated);
  };

  const handleNombreChange = (index: number, nombreVal: string) => {
    const updated = [...autores];
    // Solo permitir edición del nombre si no coincide con un usuario registrado
    const matched = USUARIOS_REGISTRADOS.find(u => u.cedula === updated[index].cedula.trim());
    if (!matched) {
      updated[index].nombre = nombreVal;
      setAutores(updated);
    }
  };

  // Manejar checklist de conflictos manuales
  const handleConflictToggle = (id: string) => {
    setConflictos(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  // Validar archivo PDF
  const validateAndSetFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se permiten archivos en formato PDF.');
      setFile(null);
      return;
    }
    const maxBytes = 15 * 1024 * 1024; // 15 MB
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tema.trim() || !descripcion.trim() || !file) {
      setError('Por favor complete todos los campos obligatorios y suba el archivo PDF.');
      return;
    }

    // Filtrar autores vacíos
    const coAutoresFiltrados = autores.filter(a => a.cedula.trim() !== '');

    // Añadir al investigador principal como primer autor
    const listaAutores: Autor[] = [
      { cedula: investigadorId, nombre: investigadorNombre },
      ...coAutoresFiltrados
    ];

    // Cruzar las cédulas para verificar conflictos de interés automáticos
    const conflictosDeclarados = [...conflictos];
    listaAutores.forEach(autor => {
      const matchEvaluador = USUARIOS_REGISTRADOS.find(u => u.cedula === autor.cedula && u.role === 'evaluator');
      if (matchEvaluador && !conflictosDeclarados.includes(matchEvaluador.id)) {
        conflictosDeclarados.push(matchEvaluador.id);
      }
    });

    const fileId = 'ver-' + Date.now(); // Generar ID único temporal para el archivo
    
    // Almacenar el archivo PDF en el cache en memoria usando el ID temporal
    ceishFileCache[fileId] = file;

    // Buscar tipo de documento semilla "tipo-investigacion"
    const tipoDocId = 'tipo-investigacion';

    // Crear el documento en el store de simulación
    crearDocumento(
      tipoDocId,
      tema.trim(),
      descripcion.trim(),
      listaAutores,
      riesgo,
      conflictosDeclarados,
      investigadorId,
      investigadorNombre,
      file.name,
      fileId
    );

    onCancel();
  };

  // Obtener lista de evaluadores para conflictos
  const evaluadoresCeish = USUARIOS_REGISTRADOS.filter(u => u.role === 'evaluator');

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" style={{ maxWidth: '650px', width: '90%' }}>
        <div className="modal__header">
          <h2 className="modal__title">Registrar Nueva Investigación</h2>
          <button className="modal__close" onClick={onCancel} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body" style={{ maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Tema de Investigación */}
            <div className="modal__field">
              <label className="modal__label">Tema / Título de la Investigación *</label>
              <input
                type="text"
                className="modal__input"
                required
                placeholder="Ej: Análisis del impacto de microplásticos en fuentes hídricas..."
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            {/* Descripción / Resumen */}
            <div className="modal__field">
              <label className="modal__label">Resumen / Descripción del Proyecto *</label>
              <textarea
                className="modal__textarea"
                required
                placeholder="Describa brevemente los objetivos, justificación y alcance del estudio..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'vertical' }}
              />
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
              <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 8px 0' }}>
                Nota: Usted ({investigadorNombre}) será registrado con cédula ({investigadorId}) como Investigador Principal.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {autores.map((autor, idx) => {
                  const match = USUARIOS_REGISTRADOS.find(u => u.cedula === autor.cedula.trim());
                  return (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            className="modal__input"
                            placeholder="Número de Cédula *"
                            required
                            value={autor.cedula}
                            onChange={(e) => handleCedulaChange(idx, e.target.value)}
                            style={{ flex: 1, padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                          />
                          <input
                            type="text"
                            className="modal__input"
                            placeholder="Nombre del co-autor"
                            disabled={!!match} // Deshabilitado si se autocompleta
                            value={match ? match.name : autor.nombre}
                            onChange={(e) => handleNombreChange(idx, e.target.value)}
                            style={{ flex: 1.5, padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: match ? '#e2e8f0' : 'white' }}
                          />
                        </div>
                        {match ? (
                          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                            ✓ Usuario registrado: {match.role === 'evaluator' ? 'Revisor CEISH (Conflicto detectado)' : 'Usuario'}
                          </span>
                        ) : autor.cedula.trim() ? (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            ⚠️ Cédula no registrada (registro manual de nombre)
                          </span>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeAutorField(idx)}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          color: '#ef4444'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clasificación de Riesgo Declarado */}
            <div className="modal__field">
              <label className="modal__label">Clasificación de Riesgo Declarado *</label>
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="riesgo"
                    checked={riesgo === 'sin-riesgo'}
                    onChange={() => setRiesgo('sin-riesgo')}
                  />
                  <span>Sin Riesgo</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#64748b' }}>
                  <input
                    type="radio"
                    name="riesgo"
                    checked={riesgo === 'riesgo-minimo'}
                    disabled
                  />
                  <span>Riesgo Mínimo (Fuera de alcance)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#64748b' }}>
                  <input
                    type="radio"
                    name="riesgo"
                    checked={riesgo === 'riesgo-mayor'}
                    disabled
                  />
                  <span>Riesgo Mayor (Fuera de alcance)</span>
                </label>
              </div>
            </div>

            {/* Declaración de Miembros del CEISH (Conflicto de Interés) */}
            <div className="modal__field">
              <label className="modal__label">Declaración Manual de Conflictos de Interés</label>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0' }}>
                Seleccione si algún otro miembro del comité CEISH (no listado en co-autores) tiene relación familiar, académica o de asesoría con su investigación para excluirlo del sorteo.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                {evaluadoresCeish.map((ev) => (
                  <label key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={conflictos.includes(ev.id)}
                      onChange={() => handleConflictToggle(ev.id)}
                    />
                    <div>
                      <strong>{ev.name}</strong> <span style={{ color: '#64748b', fontSize: '11px' }}>({ev.cargo})</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Carga de archivo PDF simulada */}
            <div className="modal__field">
              <label className="modal__label">Protocolo de Investigación (PDF) *</label>
              <div
                className={`upload-zone ${file ? 'upload-zone--has-file' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: file ? '#eff6ff' : '#f8fafc',
                  transition: 'all 0.2s'
                }}
              >
                {file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
                      <path d="M4 2h10a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="#2563eb" strokeWidth="1.5" />
                      <path d="M6 7h6M6 10h4" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', margin: 0 }}>{file.name}</p>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>PDF · {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <span style={{ fontSize: '12px', color: '#2563eb', marginLeft: 'auto', textDecoration: 'underline' }}>Cambiar</span>
                  </div>
                ) : (
                  <div>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 8px auto', color: '#94a3b8' }}>
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <p style={{ fontWeight: 500, fontSize: '14px', margin: 0, color: '#334155' }}>Seleccione el archivo de su protocolo</p>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>Solo archivos PDF · Máximo 15 MB</p>
                  </div>
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

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
                {error}
              </div>
            )}
          </div>

          <div className="modal__footer">
            <button type="button" className="eval-btn eval-btn--outline" onClick={onCancel}>Cancelar</button>
            <button
              type="submit"
              className="eval-btn eval-btn--primary"
              disabled={!tema.trim() || !descripcion.trim() || !file}
            >
              Registrar Proyecto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
