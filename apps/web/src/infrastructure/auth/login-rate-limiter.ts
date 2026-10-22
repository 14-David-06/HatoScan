/**
 * Límite de intentos fallidos de inicio de sesión, por cédula y por dirección IP, en memoria.
 * Frena la fuerza bruta y el gasto de cuota de Airtable. Es por instancia del servidor: en un
 * despliegue con varias instancias cada una cuenta por su lado, lo que sigue siendo una barrera
 * razonable hasta que haya un almacén compartido.
 */

export interface LoginRateLimiterOptions {
  /** Fallos seguidos permitidos por cédula antes de bloquear. */
  readonly maxPerId?: number;
  /** Fallos seguidos permitidos por IP antes de bloquear. */
  readonly maxPerIp?: number;
  /** Ventana de conteo y duración del bloqueo, en milisegundos. */
  readonly windowMs?: number;
  readonly now?: () => number;
}

export interface LoginAttemptKey {
  readonly nationalId: string;
  readonly ip: string;
}

interface Bucket {
  failures: number;
  /** Fin de la ventana actual (ms epoch). */
  resetAt: number;
}

export class LoginRateLimiter {
  private readonly byId = new Map<string, Bucket>();
  private readonly byIp = new Map<string, Bucket>();
  private readonly maxPerId: number;
  private readonly maxPerIp: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: LoginRateLimiterOptions = {}) {
    this.maxPerId = options.maxPerId ?? 5;
    this.maxPerIp = options.maxPerIp ?? 30;
    this.windowMs = options.windowMs ?? 15 * 60 * 1000;
    this.now = options.now ?? Date.now;
  }

  /** `true` si todavía se admite un intento para esta cédula desde esta IP. */
  isAllowed(key: LoginAttemptKey): boolean {
    this.prune();
    return (
      this.count(this.byId, key.nationalId) < this.maxPerId &&
      this.count(this.byIp, key.ip) < this.maxPerIp
    );
  }

  /** Un intento fallido: suma en las dos cuentas. */
  recordFailure(key: LoginAttemptKey): void {
    this.bump(this.byId, key.nationalId);
    this.bump(this.byIp, key.ip);
  }

  /** Un acceso correcto limpia la cuenta de esa cédula (la de la IP sigue, por si es compartida). */
  recordSuccess(key: LoginAttemptKey): void {
    this.byId.delete(key.nationalId);
  }

  private count(buckets: Map<string, Bucket>, key: string): number {
    const bucket = buckets.get(key);
    return bucket && bucket.resetAt > this.now() ? bucket.failures : 0;
  }

  private bump(buckets: Map<string, Bucket>, key: string): void {
    if (!key) return;
    const now = this.now();
    const bucket = buckets.get(key);
    if (bucket && bucket.resetAt > now) {
      bucket.failures += 1;
    } else {
      buckets.set(key, { failures: 1, resetAt: now + this.windowMs });
    }
  }

  private prune(): void {
    const now = this.now();
    for (const buckets of [this.byId, this.byIp]) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
    }
  }
}
