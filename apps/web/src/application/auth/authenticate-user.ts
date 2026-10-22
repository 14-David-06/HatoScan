import {
  normalizeNationalId,
  type PasswordHasher,
  type User,
  type UserDirectory,
} from '@/domain/index';
import { InvalidCredentialsError } from '../errors';

export interface AuthenticateUserInput {
  readonly nationalId: string;
  readonly password: string;
}

/** Comprueba cédula y contraseña. Devuelve el usuario sin su hash, o lanza InvalidCredentialsError. */
export class AuthenticateUser {
  constructor(
    private readonly deps: { readonly users: UserDirectory; readonly passwords: PasswordHasher },
  ) {}

  async execute({ nationalId, password }: AuthenticateUserInput): Promise<User> {
    const id = normalizeNationalId(nationalId);
    const account = id ? await this.deps.users.findByNationalId(id) : undefined;
    // Se verifica la contraseña aunque la cuenta esté inactiva: misma respuesta y mismo coste.
    const valid = account
      ? await this.deps.passwords.verify(password, account.passwordHash)
      : false;
    if (!account || !account.active || !valid) throw new InvalidCredentialsError();
    return {
      id: account.id,
      name: account.name,
      nationalId: account.nationalId,
      role: account.role,
    };
  }
}
