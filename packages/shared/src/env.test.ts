import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const base = { CODE_HMAC_SECRET: 'dev-only-code-hmac-secret', DATABASE_URL: 'postgres://u:dev-only-p@h/db' };

describe('parseEnv', () => {
  it('accepts the development values', () => {
    const { env, problems } = parseEnv(base);
    expect(problems).toEqual([]);
    expect(env?.PORT).toBe(3100);
    expect(env?.REDIS_URL).toBeNull();
  });
  it('refuses development secrets, http and no origins in production', () => {
    const { env, problems } = parseEnv({ ...base, NODE_ENV: 'production', PUBLIC_URL: 'http://1.2.3.4:8080' });
    expect(env).toBeNull();
    expect(problems.join('\n')).toMatch(/CODE_HMAC_SECRET/);
    expect(problems.join('\n')).toMatch(/DATABASE_URL/);
    expect(problems.join('\n')).toMatch(/https obligatoire/);
    expect(problems.join('\n')).toMatch(/ALLOWED_ORIGINS/);
  });
  it('allows http in production when ALLOW_INSECURE is set', () => {
    const { problems } = parseEnv({ CODE_HMAC_SECRET: 'x'.repeat(40), DATABASE_URL: 'postgres://u:strong@h/db', NODE_ENV: 'production',
      PUBLIC_URL: 'http://1.2.3.4:8080', ALLOW_INSECURE: 'true', ALLOWED_ORIGINS: 'chrome-extension://abc' });
    expect(problems).toEqual([]);
  });
  it('says which variable is wrong', () => {
    const { problems } = parseEnv({ CODE_HMAC_SECRET: 'short', DATABASE_URL: 'mysql://x' });
    expect(problems.some(p => p.startsWith('CODE_HMAC_SECRET'))).toBe(true);
    expect(problems.some(p => p.startsWith('DATABASE_URL'))).toBe(true);
  });
});
