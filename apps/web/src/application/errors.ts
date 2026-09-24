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
