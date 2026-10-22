import { describe, expect, it } from 'vitest';
import { LoginRateLimiter } from './login-rate-limiter';

const KEY = { nationalId: '1234567890', ip: '10.0.0.1' };

function setup(maxPerId = 3, maxPerIp = 5) {
  let now = 1_000_000;
  const limiter = new LoginRateLimiter({ maxPerId, maxPerIp, windowMs: 1000, now: () => now });
  return { limiter, advance: (ms: number) => (now += ms) };
}

describe('LoginRateLimiter', () => {
  it('blocks the ID after too many failures and frees it when the window ends', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 3; i++) {
      expect(limiter.isAllowed(KEY)).toBe(true);
      limiter.recordFailure(KEY);
    }
    expect(limiter.isAllowed(KEY)).toBe(false);
    expect(limiter.isAllowed({ ...KEY, nationalId: '9' })).toBe(true);
    advance(1001);
    expect(limiter.isAllowed(KEY)).toBe(true);
  });

  it('blocks an IP that fails across many IDs', () => {
    const { limiter } = setup(3, 4);
    for (let i = 0; i < 4; i++) limiter.recordFailure({ ...KEY, nationalId: String(i) });
    expect(limiter.isAllowed({ ...KEY, nationalId: 'otra' })).toBe(false);
    expect(limiter.isAllowed({ nationalId: 'otra', ip: '10.0.0.2' })).toBe(true);
  });

  it('a success clears the ID count but not the IP count', () => {
    const { limiter } = setup(2, 3);
    limiter.recordFailure(KEY);
    limiter.recordFailure(KEY);
    expect(limiter.isAllowed(KEY)).toBe(false);
    limiter.recordSuccess(KEY);
    expect(limiter.isAllowed(KEY)).toBe(true);
    limiter.recordFailure(KEY);
    // Tercer fallo desde la misma IP: ahora bloquea la IP.
    expect(limiter.isAllowed(KEY)).toBe(false);
  });
});
