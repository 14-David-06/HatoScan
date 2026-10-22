export class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CountNotFoundError extends ApplicationError {
  constructor(countId: string) {
    super(`Count ${countId} not found`);
  }
}

/** Cédula o contraseña incorrectas, o cuenta inactiva. Un solo error: no revela cuál falló. */
export class InvalidCredentialsError extends ApplicationError {
  constructor() {
    super('Invalid credentials');
  }
}
