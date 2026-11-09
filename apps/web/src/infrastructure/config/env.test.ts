import { describe, expect, it, vi } from 'vitest';
import { parseEnv } from './env';

vi.mock('server-only', () => ({}));

const VALID = {
  APP_BASE_URL: 'http://localhost:3000/',
  AUTH_SESSION_SECRET: 'a'.repeat(32),
  AIRTABLE_API_TOKEN: 'pat.test',
  AIRTABLE_BASE_ID: 'appVDDMhvDjfztAC7',
  AIRTABLE_USUARIOS_TABLE_ID: 'tblQA987e1z7uaOsV',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_SIGNING_SECRET: 'b'.repeat(32),
};

describe('parseEnv', () => {
  it('applies the detection defaults and treats empty values as unset', () => {
    const env = parseEnv({
      ...VALID,
      ANTHROPIC_API_KEY: '',
      DETECTOR_ENABLED_METHODS: '',
    });
    expect(env.APP_BASE_URL).toBe('http://localhost:3000');
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.DETECTOR_DEFAULT_METHOD).toBe('claude-vision');
    expect(env.DETECTOR_ENABLED_METHODS).toBeUndefined();
    expect(env.DETECTOR_TIMEOUT_MS).toBe(780_000);
  });

  it('reads the enabled methods as a comma-separated list', () => {
    const env = parseEnv({ ...VALID, DETECTOR_ENABLED_METHODS: ' claude-vision , openai-vision,' });
    expect(env.DETECTOR_ENABLED_METHODS).toEqual(['claude-vision', 'openai-vision']);
  });

  it('names every invalid variable in a plain Error', () => {
    const run = () => parseEnv({ ...VALID, AUTH_SESSION_SECRET: '', AIRTABLE_API_TOKEN: '' });
    expect(run).toThrow(Error);
    expect(run).toThrow(/AUTH_SESSION_SECRET: .*\n.*AIRTABLE_API_TOKEN/);
    expect(run).toThrow(/\.env\.example/);
  });

  it('rejects a timeout that would outlive the 800 s function limit', () => {
    expect(() => parseEnv({ ...VALID, DETECTOR_TIMEOUT_MS: '800000' })).toThrow(
      /DETECTOR_TIMEOUT_MS/,
    );
  });
});
