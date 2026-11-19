// The server's configuration, read from the environment and checked at start (openspec: repo-and-secrets).
import { z } from 'zod';
import { isInsecureUrl } from './url.js';

const bool = z.enum(['true', 'false', '1', '0', '']).default('false').transform(v => v === 'true' || v === '1');
const optional = z.string().trim().default('').transform(v => v || null);
const list = z.string().default('').transform(v => v.split(',').map(s => s.trim()).filter(Boolean));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(23100),
  PUBLIC_URL: z.url().default('http://localhost:23100'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ALLOWED_ORIGINS: list,
  ALLOW_INSECURE: bool,
  TRUST_PROXY: bool,   // behind Caddy: the player's address is in X-Forwarded-For
  CODE_HMAC_SECRET: z.string().min(16, 'au moins 16 caractères'),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'une adresse postgres://…'),
  REDIS_URL: optional,
  S3_ENDPOINT: optional,
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: optional,
  S3_SECRET_KEY: optional,
  S3_BUCKET_DURABLE: z.string().default('slopesque-durable'),
  S3_BUCKET_CHAT: z.string().default('slopesque-chat'),
  STORAGE_QUOTA_GB: z.coerce.number().positive().default(50),
  ROBOT_DELAY_MS: z.coerce.number().int().min(0).default(900),   // a card robot's thinking time (tests lower it)
  CODE_ATTEMPTS_PER_MINUTE: z.coerce.number().int().positive().default(10),   // unknown codes per IP (tests raise it)
  KLIPY_API_KEY: optional,
  KLIPY_API_KEY_WITH_AD: optional,   // the last resort of the GIF chain: KLIPY with its ads
  GIPHY_API_KEY: optional,
});
export type Env = z.infer<typeof envSchema>;

/** Variables that must not keep their development value in production. */
const SECRET_VARS = ['CODE_HMAC_SECRET', 'DATABASE_URL', 'S3_SECRET_KEY'] as const;

/** The environment checked; the problems, one line per variable (French, shown to the admin). */
export function parseEnv(raw: Record<string, string | undefined>): { env: Env | null; problems: string[] } {
  const r = envSchema.safeParse(raw);
  if (!r.success) return { env: null, problems: r.error.issues.map(i => `${i.path.join('.')} : ${i.message}`) };
  const env = r.data, problems: string[] = [];
  if (env.NODE_ENV === 'production') {
    for (const k of SECRET_VARS) if (String(env[k] ?? '').includes('dev-only')) problems.push(`${k} : valeur de développement interdite en production`);
    if (isInsecureUrl(env.PUBLIC_URL) && !env.ALLOW_INSECURE) problems.push('PUBLIC_URL : https obligatoire en production (ou ALLOW_INSECURE=true, connexion non chiffrée)');
    if (!env.ALLOWED_ORIGINS.length) problems.push('ALLOWED_ORIGINS : vide interdit en production (origines de l\'extension)');
  }
  return { env: problems.length ? null : env, problems };
}

/** An origin allowed by ALLOWED_ORIGINS: exact, or a pattern ending with « * » (chrome-extension://* while the
 *  extension has no fixed id). Empty list: any (development). */
export const originAllowed = (allowed: string[], origin: string | undefined) =>
  !allowed.length || !origin || allowed.some(a => (a.endsWith('*') ? origin.startsWith(a.slice(0, -1)) : a === origin));
