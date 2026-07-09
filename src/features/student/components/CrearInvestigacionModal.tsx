import { useRef, useState } from 'react';
import { useCeishStore } from '../../../store/ceishStore';
import { ceishFileCache } from '../../../store/fileCache';
import '../../student/student.css';

interface Props {
  onCancel: () => void;
  investigadorId: string;
  investigadorNombre: string;
}

const EVALUADORES_CEISH = [
  { id: 'b0000000-0000-0000-0000-000000000001', name: 'Profesor Demo', cargo: 'Presidente del Comité' },
  { id: 'b0000000-0000-0000-0000-000000000002', name: 'Evaluador Alterno CEISH', cargo: 'Secretario CEISH' },
  { id: 'b0000000-0000-0000-0000-000000000003', name: 'Dr. Roberto Anchundia', cargo: 'Vocal Técnico' }
];

export function CrearInvestigacionModal({ onCancel, investigadorId, investigadorNombre }: Props) {
  const crearInvestigacion = useCeishStore((s) => s.crearInvestigacion);

  const [tema, setTema] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [autores, setAutores] = useState<string[]>(['']); // El autor principal se asume cargador, co-autores dinámicos
  const [riesgo, setRiesgo] = useState<'sin-riesgo' | 'riesgo-minimo' | 'riesgo-mayor'>('sin-riesgo');
  const [conflictos, setConflictos] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manejar adición de autores
  const addAutorField = () => setAutores([...autores, '']);
  const removeAutorField = (index: number) => {
    const updated = autores.filter((_, i) => i !== index);
    setAutores(updated.length ? updated : ['']);
  };
  const handleAutorChange = (index: number, val: string) => {
    const updated = [...autores];
    updated[index] = val;
    setAutores(updated);
  };

  // Manejar checklist de conflictos
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

    // Filtrar autores vacíos y añadir el nombre del investigador como primer autor
    const coAutoresFiltrados = autores.filter(a => a.trim() !== '');
    const listaAutores = [investigadorNombre, ...coAutoresFiltrados];

    const fileId = 'ver-' + Date.now(); // Generar ID único temporal para el archivo
    
    // Almacenar el archivo PDF en el cache en memoria usando el ID temporal
    ceishFileCache[fileId] = file;

    // Crear la investigación en el store simulado
    crearInvestigacion(
      tema.trim(),
      descripcion.trim(),
      listaAutores,
      riesgo,
      conflictos,
      investigadorId,
      investigadorNombre,
      file.name,
      fileId // Guardamos el ID temporal como documentPath
    );

    onCancel();
  };

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

            {/* Co-autores dinámicos */}
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
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 8px 0' }}>
                Nota: Usted ({investigadorNombre}) será registrado automáticamente como el Investigador Principal.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {autores.map((autor, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="modal__input"
                      placeholder={`Nombre del co-autor #${idx + 1}`}
                      value={autor}
                      onChange={(e) => handleAutorChange(idx, e.target.value)}
                      style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeAutorField(idx)}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        color: '#ef4444'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
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
                    onChange={() => setRiesgo('riesgo-minimo')}
                  />
                  <span>Riesgo Mínimo</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#64748b' }}>
                  <input
                    type="radio"
                    name="riesgo"
                    checked={riesgo === 'riesgo-mayor'}
                    onChange={() => setRiesgo('riesgo-mayor')}
                  />
                  <span>Riesgo Mayor</span>
                </label>
              </div>
            </div>

            {/* Declaración de Miembros del CEISH (Conflicto de Interés) */}
            <div className="modal__field">
              <label className="modal__label">Miembros del CEISH en el Proyecto (Conflicto de Interés)</label>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0' }}>
                Seleccione si alguno de los miembros del comité CEISH listados abajo participa en su investigación como autor, asesor o colaborador. Esto evitará que la plataforma los asigne automáticamente para evaluar su documento.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                {EVALUADORES_CEISH.map((ev) => (
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
