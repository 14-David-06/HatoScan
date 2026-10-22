import type { PersonId } from '../count/count-id';

export const USER_ROLES = ['revisor', 'lector'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Persona con sesión en HatoScan. Su `id` es el que queda como revisor en cada conteo. */
export interface User {
  readonly id: PersonId;
  readonly name: string;
  /** Número de cédula, solo dígitos: con él se ingresa. */
  readonly nationalId: string;
  readonly role: UserRole;
}

/** Cuenta tal como la guarda el directorio de usuarios (incluye el hash de la contraseña). */
export interface UserAccount extends User {
  readonly active: boolean;
  readonly passwordHash: string;
}

/** Solo un revisor sube fotos, ejecuta detecciones y confirma conteos; un lector solo consulta. */
export function canReview(user: Pick<User, 'role'>): boolean {
  return user.role === 'revisor';
}

/** Cédula normalizada: solo dígitos (acepta «1.006.774.686» o con espacios). */
export function normalizeNationalId(value: string): string {
  return value.replace(/\D/g, '');
}
