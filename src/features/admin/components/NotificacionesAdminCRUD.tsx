import { useState, useEffect } from 'react';
import { useCeishStore } from '../../../store/ceishStore';
import { platformService } from '../../../shared/services/platformService';
import type { User } from '../../../shared/types/platform.types';

const ROLE_LABEL: Record<string, string> = {
  student: 'Investigadores',
  evaluator: 'Evaluadores',
  admin: 'Administradores'
};

export function NotificacionesAdminCRUD() {
  const { notificaciones, enviarNotificacionManual } = useCeishStore();

  const [usuarios, setUsuarios] = useState<User[]>([]);
  useEffect(() => {
    platformService.getUsers().then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const toggleUsuario = (id: string) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleRol = (rol: string) => {
    const idsDelRol = usuarios.filter(u => u.role === rol).map(u => u.id);
    const todosYaSeleccionados = idsDelRol.every(id => seleccionados.includes(id));
    setSeleccionados(prev =>
      todosYaSeleccionados
        ? prev.filter(id => !idsDelRol.includes(id))
        : Array.from(new Set([...prev, ...idsDelRol]))
    );
  };

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (seleccionados.length === 0 || !mensaje.trim()) {
      return;
    }
    setIsSending(true);
    try {
      await enviarNotificacionManual(seleccionados, mensaje.trim());
      setFeedback(`Mensaje enviado a ${seleccionados.length} destinatario(s).`);
      setSeleccionados([]);
      setMensaje('');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al enviar la notificación.');
    } finally {
      setIsSending(false);
    }
  };

  const enviados = notificaciones
    .filter(n => n.tipo === 'manual')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const nombreDe = (id: string) => usuarios.find(u => u.id === id)?.name ?? id;

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
                {usuarios.filter(u => u.role === rol).map(u => (
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
            disabled={seleccionados.length === 0 || !mensaje.trim() || isSending}
          >
            {isSending ? 'Enviando…' : `Enviar a ${seleccionados.length} destinatario(s)`}
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
