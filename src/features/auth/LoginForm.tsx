// src/features/auth/components/LoginForm.tsx
import React, { useState } from 'react';
import './LoginForm.css';

import { colors, typography } from '../../shared/components/common/colors';
import type { LoginResult } from '../../services/authService';
import Input from '../../shared/components/common/Input';
import Button from '../../shared/components/common/Button';
import Card from '../../shared/components/common/Card';

interface LoginFormProps {
  /** Recibe email y password, devuelve LoginResult */
  onSubmit: (email: string, password: string) => Promise<LoginResult>;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSubmit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'El correo es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = 'Ingresa un correo válido';
    if (!password) next.password = 'La contraseña es requerida';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const clearFieldError = (field: 'email' | 'password') => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setGeneralError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setGeneralError(null);
    setSuccessMessage(null);

    try {
      const result = await onSubmit(email.trim().toLowerCase(), password);

      if (result.success) {
        setSuccessMessage('Autenticación exitosa. Redirigiendo…');
      } else {
        setGeneralError(result.error ?? 'Error al iniciar sesión. Intenta de nuevo.');
      }
    } catch {
      setGeneralError('Error de conexión. Por favor intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card variant="elevated" padding="md">
      {/* Header */}
      <div className="login-form__header">
        <h1
          className="login-form__title"
          style={{
            color: colors.surface.dark,
            fontFamily: typography.fontFamily.display,
          }}
        >
          Acceso a Plataforma
        </h1>
        <p
          className="login-form__subtitle"
          style={{
            color: colors.gray[600],
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily.body,
          }}
        >
          Inicia sesión con tu correo institucional
        </p>
      </div>

      {/* Línea decorativa */}
      <div
        className="login-form__divider-top"
        style={{
          background: `linear-gradient(90deg, ${colors.primary[500]} 0%, ${colors.success[500]} 100%)`,
        }}
      />

      {/* Mensajes de estado */}
      {generalError && (
        <div className="login-form__alert login-form__alert--error">
          <span className="login-form__alert-icon">⚠️</span>
          <p className="login-form__alert-text">{generalError}</p>
        </div>
      )}

      {successMessage && (
        <div className="login-form__alert login-form__alert--success">
          <span className="login-form__alert-icon">✓</span>
          <p className="login-form__alert-text">{successMessage}</p>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="login-form__form" noValidate>
        <Input
          label="Correo institucional"
          type="email"
          name="email"
          placeholder="usuario@live.uleam.edu.ec"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFieldError('email');
          }}
          error={errors.email}
          required
          disabled={isLoading}
          autoComplete="email"
        />

        <Input
          label="Contraseña"
          type="password"
          name="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearFieldError('password');
          }}
          error={errors.password}
          required
          disabled={isLoading}
          autoComplete="current-password"
        />

        <Button
          type="submit"
          variant="primary"
          size="sm"
          fullWidth
          isLoading={isLoading}
          disabled={isLoading}
          className="login-form__submit"
        >
          {isLoading ? 'Verificando…' : 'Iniciar sesión'}
        </Button>
      </form>

      {/* Divider */}
      <div className="login-form__divider">
        <div
          className="login-form__divider-line"
          style={{ backgroundColor: colors.border }}
        />
        <span
          className="login-form__divider-text"
          style={{ color: colors.gray[500], fontSize: typography.fontSize.xs }}
        >
          O
        </span>
        <div
          className="login-form__divider-line"
          style={{ backgroundColor: colors.border }}
        />
      </div>

      {/* Links */}
      <div className="login-form__links">
        <a
          href="#forgot"
          className="login-form__link"
          style={{ color: colors.primary[500], border: `1px solid ${colors.border}` }}
        >
          Recuperar acceso
        </a>
        <a
          href="#support"
          className="login-form__link"
          style={{ color: colors.gray[700], border: `1px solid ${colors.border}` }}
        >
          Centro de ayuda
        </a>
      </div>

      {/* Footer */}
      <div
        className="login-form__footer"
        style={{
          borderTop: `1px solid ${colors.border}`,
          color: colors.gray[500],
          fontSize: typography.fontSize.xs,
        }}
      >
        <p>
          ¿Problemas para acceder?{' '}
          <a
            href="#"
            className="login-form__footer-link"
            style={{ color: colors.primary[500] }}
          >
            Contacta soporte
          </a>
        </p>
      </div>
    </Card>
  );
};

export default LoginForm;
