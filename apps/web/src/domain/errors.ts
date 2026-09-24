export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidTransitionError extends DomainError {}

export class InvalidDetectionError extends DomainError {}

export class InvalidValueError extends DomainError {}
