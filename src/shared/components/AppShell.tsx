import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useCeishStore } from '../../store/ceishStore';
import { cn } from '../../utils/cn';
import '../styles/platform.css';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const STUDENT_NAV: NavItem[] = [
  {
    to: '/estudiante',
    label: 'Mis investigaciones',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 2h10a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 7h6M6 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const EVALUATOR_NAV: NavItem[] = [
  {
    to: '/evaluador',
    label: 'Mis revisiones',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 15c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    to: '/admin',
    label: 'Panel general',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/admin/asignaciones',
    label: 'Asignaciones',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2v14M2 9h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/admin/anexos',
    label: 'Configurar Anexos',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M14 2H4a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6 6h6M6 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/admin/tipos-documento',
    label: 'Configurar Flujos',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 9h14M5 5l-3 4 3 4M13 5l3 4-3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/admin/notificaciones',
    label: 'Notificaciones',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M14 6a5 5 0 00-10 0c0 5.5-2.5 7-2.5 7h15S14 11.5 14 6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10.7 16.5a1.6 1.6 0 01-2.75 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const ROLE_LABEL = { student: 'Investigador', evaluator: 'Revisor', admin: 'Administrador' };

function formatNotifDate(iso: string): string {
  return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function AppShell() {
  const { currentUser, logout } = useAuthStore();
  const { notificaciones, marcarNotificacionLeida } = useCeishStore();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifPanelPos, setNotifPanelPos] = useState({ top: 0, left: 0 });
  const notifBellRef = useRef<HTMLButtonElement>(null);

  const toggleNotifications = () => {
    if (!showNotifications && notifBellRef.current) {
      const rect = notifBellRef.current.getBoundingClientRect();
      setNotifPanelPos({ top: rect.bottom + 8, left: rect.left });
    }
    setShowNotifications((v) => !v);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { replace: true });
    }
  }, [currentUser, navigate]);

  if (!currentUser) {
    return null;
  }

  const misNotificaciones = notificaciones
    .filter(n => n.destinatarioId === currentUser.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const noLeidas = misNotificaciones.filter(n => !n.leida).length;

  // Permisos y navegación acumulativa por roles (Investigador < Revisor < Administrador)
  let navItems: NavItem[] = [];
  if (currentUser.role === 'student') {
    navItems = [...STUDENT_NAV];
  } else if (currentUser.role === 'evaluator') {
    navItems = [...STUDENT_NAV, ...EVALUATOR_NAV];
  } else if (currentUser.role === 'admin') {
    navItems = [...STUDENT_NAV, ...EVALUATOR_NAV, ...ADMIN_NAV];
  }

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#2563eb" />
            <path d="M6 8h12M6 12h12M6 16h7" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="shell__brand-name">CEISH</span>

          <div className="shell__notif">
            <button
              ref={notifBellRef}
              className="shell__notif-bell"
              onClick={toggleNotifications}
              title="Notificaciones"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {noLeidas > 0 && <span className="shell__notif-badge">{noLeidas > 9 ? '9+' : noLeidas}</span>}
            </button>

            {showNotifications && (
              <>
                <div className="shell__notif-backdrop" onClick={() => setShowNotifications(false)} />
                <div
                  className="shell__notif-panel"
                  style={{ top: notifPanelPos.top, left: notifPanelPos.left }}
                >
                  <div className="shell__notif-panel-header">Notificaciones</div>
                  {misNotificaciones.length === 0 ? (
                    <p className="shell__notif-empty">No tienes notificaciones.</p>
                  ) : (
                    <ul className="shell__notif-list">
                      {misNotificaciones.map(n => (
                        <li
                          key={n.id}
                          className={cn('shell__notif-item', !n.leida && 'shell__notif-item--unread')}
                          onClick={() => marcarNotificacionLeida(n.id)}
                        >
                          <p className="shell__notif-msg">{n.mensaje}</p>
                          <span className="shell__notif-meta">
                            {n.tipo === 'manual' ? 'Mensaje del admin' : 'Automática'} · {formatNotifDate(n.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <nav className="shell__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) => cn('shell__nav-item', isActive && 'shell__nav-item--active')}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shell__user">
          <div className="shell__user-avatar">{currentUser.name.charAt(0)}</div>
          <div className="shell__user-info">
            <p className="shell__user-name">{currentUser.name}</p>
            <p className="shell__user-role">{ROLE_LABEL[currentUser.role]}</p>
          </div>
          <button 
            className="shell__logout" 
            onClick={() => {
              if (window.confirm('¿Deseas restablecer todos los datos del prototipo CEISH? Esto borrará el historial de pruebas.')) {
                useCeishStore.getState().resetearDatos();
                window.location.reload();
              }
            }} 
            title="Restablecer prototipo"
            style={{ marginRight: '8px', color: '#eab308' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M16 3h5v5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 21H3v-5" />
            </svg>
          </button>
          <button className="shell__logout" onClick={handleLogout} title="Cerrar sesión">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2M7 11l3-3-3-3M10 8H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="shell__content">
        <Outlet />
      </main>
    </div>
  );
}
