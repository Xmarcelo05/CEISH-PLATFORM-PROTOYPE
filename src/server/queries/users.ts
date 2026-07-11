// Consultas SQL del dominio de usuarios (lado servidor).
import { query } from '../../lib/database';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  cedula: string | null;
  created_at: string;
}

export async function listUsers(): Promise<UserRow[]> {
  return query<UserRow>(
    `SELECT u.id, u.name, u.email, r.name AS role, u.cedula, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
      ORDER BY u.created_at`,
  );
}

export async function listUsersByRole(role: string): Promise<UserRow[]> {
  return query<UserRow>(
    `SELECT u.id, u.name, u.email, r.name AS role, u.cedula, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE r.name = $1
      ORDER BY u.name`,
    [role],
  );
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const rows = await query<UserRow>(
    `SELECT u.id, u.name, u.email, r.name AS role, u.cedula, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await query<UserRow>(
    `SELECT u.id, u.name, u.email, r.name AS role, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.email = $1`,
    [email],
  );
  return rows[0] ?? null;
}
