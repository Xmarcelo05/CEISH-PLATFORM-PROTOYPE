import { useState } from 'react';
import { useCeishStore } from '../../../store/ceishStore';

// Directorio simulado de usuarios (mismo esquema de IDs deterministas usado en
// database/seed.sql y replicado en USUARIOS_REGISTRADOS de CrearInvestigacionModal.tsx)
const USUARIOS_SISTEMA = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Admin Demo', role: 'admin' as const },
  { id: 'b0000000-0000-0000-0000-000000000001', name: 'Profesor Demo', role: 'evaluator' as const },
  { id: 'b0000000-0000-0000-0000-000000000002', name: 'Evaluador Alterno CEISH', role: 'evaluator' as const },
  { id: 'b0000000-0000-0000-0000-000000000003', name: 'Dr. Roberto Anchundia', role: 'evaluator' as const },
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Juan Pérez', role: 'student' as const },
  { id: 'c0000000-0000-0000-0000-000000000002', name: 'María López', role: 'student' as const },
  { id: 'c0000000-0000-0000-0000-000000000003', name: 'Carlos Ruiz', role: 'student' as const }
];

const ROLE_LABEL: Record<string, string> = {
  student: 'Investigadores',
  evaluator: 'Evaluadores',
  admin: 'Administradores'
};

export function NotificacionesAdminCRUD() {
  const { notificaciones, enviarNotificacionManual } = useCeishStore();

  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const toggleUsuario = (id: string) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleRol = (rol: string) => {
    const idsDelRol = USUARIOS_SISTEMA.filter(u => u.role === rol).map(u => u.id);
    const todosYaSeleccionados = idsDelRol.every(id => seleccionados.includes(id));
    setSeleccionados(prev =>
      todosYaSeleccionados
        ? prev.filter(id => !idsDelRol.includes(id))
        : Array.from(new Set([...prev, ...idsDelRol]))
    );
  };

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (seleccionados.length === 0 || !mensaje.trim()) {
      return;
    }
    enviarNotificacionManual(seleccionados, mensaje.trim());
    setFeedback(`Mensaje enviado a ${seleccionados.length} destinatario(s).`);
    setSeleccionados([]);
    setMensaje('');
  };

  const enviados = notificaciones
    .filter(n => n.tipo === 'manual')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const nombreDe = (id: string) => USUARIOS_SISTEMA.find(u => u.id === id)?.name ?? id;

  return (
    <div className="admin-crud-panel">
      <div className="crud-form-header">
        <h3>Enviar Notificación Manual</h3>
      </div>

      <form className="crud-form" onSubmit={handleEnviar}>
        <div className="crud-form-grid">
          <label>Destinatarios</label>
          {(['admin', 'evaluator', 'student'] as const).map(rol => (
            <div key={rol} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <button
                  type="button"
                  className="eval-btn eval-btn--sm eval-btn--outline"
                  onClick={() => toggleRol(rol)}
                >
                  {ROLE_LABEL[rol]}: seleccionar/deseleccionar todos
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px' }}>
                {USUARIOS_SISTEMA.filter(u => u.role === rol).map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={seleccionados.includes(u.id)}
                      onChange={() => toggleUsuario(u.id)}
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <label htmlFor="mensaje-manual">Mensaje</label>
          <textarea
            id="mensaje-manual"
            rows={4}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Escribe el mensaje que recibirán los destinatarios seleccionados..."
          />
        </div>

        <div className="crud-form-actions">
          {feedback && <span style={{ fontSize: '12px', color: '#16a34a', marginRight: 'auto' }}>{feedback}</span>}
          <button
            type="submit"
            className="eval-btn eval-btn--primary"
            disabled={seleccionados.length === 0 || !mensaje.trim()}
          >
            Enviar a {seleccionados.length} destinatario(s)
          </button>
        </div>
      </form>

      <div className="crud-list-header">
        <h3>Historial de Mensajes Enviados</h3>
      </div>
      <div className="crud-grid">
        {enviados.length === 0 ? (
          <div className="crud-empty">Aún no se han enviado mensajes manuales.</div>
        ) : (
          enviados.map(n => (
            <div key={n.id} className="crud-card">
              <div className="crud-card__header">
                <span className="crud-card__badge">{n.leida ? 'Leído' : 'No leído'}</span>
              </div>
              <h4 className="crud-card__title">{nombreDe(n.destinatarioId)}</h4>
              <p className="crud-card__desc">{n.mensaje}</p>
              <p className="crud-card__desc">{new Date(n.createdAt).toLocaleString('es-EC')}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
