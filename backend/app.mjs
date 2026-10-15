import { Pool } from 'pg';
import { PostgresDialect } from 'kysely';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { betterAuth } from 'better-auth';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { getMigrations } from 'better-auth/db/migration';
import nodemailer from 'nodemailer';
import { githubProviders } from './github.mjs';
import { checkProductionConfig } from './config.mjs';

const ids = new Set(JSON.parse(readFileSync(new URL('./data/question-ids.json', import.meta.url), 'utf8')));
export async function createServer(options = {}) {
 const production = options.production ?? process.env.NODE_ENV === 'production';
 const storage = resolve(options.storage ?? process.env.STORAGE_DIR ?? 'storage');
 mkdirSync(storage, { recursive: true });
 const frontend = options.frontend ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';
 const baseURL = options.baseURL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:4000';
 const socialProviders = githubProviders(options.github);
 let secret = options.secret ?? process.env.BETTER_AUTH_SECRET;
 const emailReady = !!(process.env.SMTP_HOST && process.env.MAIL_FROM);
 const { emailPasswordEnabled, emailVerificationRequired } = checkProductionConfig({ production, secret, frontend, baseURL, emailReady, githubEnabled: !!socialProviders.github });
 if (!secret) {
  const secretPath = join(storage, 'auth-secret');
  if (!existsSync(secretPath)) writeFileSync(secretPath, randomBytes(48).toString('base64url'), { mode: 0o600 });
  secret = readFileSync(secretPath, 'utf8');
 }
 const connectionString = options.connectionString ?? process.env.DATABASE_URL;
 if (!connectionString) throw Error('DATABASE_URL is required for the Node API.');
 const schema = options.schema ?? 'a2z_sheet';
 if (!/^[a-z][a-z0-9_]*$/.test(schema)) throw Error('Invalid database schema name.');
 const db = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 15000, idleTimeoutMillis: 30000, ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.DATABASE_CA_FILE || new URL('./certs/supabase-ca.crt', import.meta.url), 'utf8') }, options: `-c search_path=${schema}` });
 await db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
 await db.query(`REVOKE ALL ON SCHEMA "${schema}" FROM PUBLIC`);
 const mail = emailReady ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}) }) : null;
 const send = async (to, subject, url) => { if (!mail) throw Error('Email delivery is not configured.'); await mail.sendMail({ from: process.env.MAIL_FROM, to, subject, text: `${subject}\n\n${url}\n\nIf you did not request this, you can ignore this email.` }); };
 const auth = betterAuth({
  appName: 'A2Z Original Sheet', database: { dialect: new PostgresDialect({ pool: db }), type: 'postgres', schemaName: schema }, secret, baseURL, trustedOrigins: [frontend],
  socialProviders,
  account: { encryptOAuthTokens: true, accountLinking: { enabled: true, allowDifferentEmails: false } },
  emailAndPassword: { enabled: emailPasswordEnabled, minPasswordLength: 12, maxPasswordLength: 128, requireEmailVerification: emailVerificationRequired, revokeSessionsOnPasswordReset: true, ...(emailReady ? { sendResetPassword: async ({ user, url }) => send(user.email, 'Reset your A2Z password', url) } : {}) },
  ...(emailReady ? { emailVerification: { sendOnSignUp: production, autoSignInAfterVerification: true, sendVerificationEmail: async ({ user, url }) => send(user.email, 'Verify your A2Z email address', url) } } : {}),
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, window: 60, max: 100 },
  advanced: { useSecureCookies: production },
 });
 const migrations = await getMigrations(auth.options);
 await migrations.runMigrations();
 await db.query(`CREATE TABLE IF NOT EXISTS question_progress (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  solved INTEGER NOT NULL DEFAULT 0,
  starred INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, question_id)
 );`);
 async function snapshot(userId) {
  const { rows } = await db.query('SELECT question_id, solved, starred, note FROM question_progress WHERE user_id = $1', [userId]);
  return { solved: rows.filter(r => r.solved).map(r => r.question_id), starred: rows.filter(r => r.starred).map(r => r.question_id), notes: Object.fromEntries(rows.filter(r => r.note).map(r => [r.question_id, r.note])) };
 }
 const app = express();
 app.disable('x-powered-by');
 if (production) app.set('trust proxy', 1);
 app.use(helmet());
 app.use(cors({ origin: frontend, credentials: true, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] }));
 app.use('/api', rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
 app.use((req, res, next) => { if (['POST','PATCH','PUT','DELETE'].includes(req.method) && req.headers.origin !== frontend) return res.status(403).json({ message: 'Untrusted request origin.' }); next(); });
 app.get('/api/health', (req, res) => res.json({ ok: true }));
 app.get('/api/config', (req, res) => res.json({ passwordResetAvailable: emailReady, emailPasswordEnabled, emailVerificationRequired, githubEnabled: !!socialProviders.github }));
 app.post('/api/auth/request-password-reset', (req, res, next) => emailReady ? next() : res.status(503).json({ message: 'Password recovery email is not configured on this server yet.' }));
 app.all('/api/auth/*splat', toNodeHandler(auth));
 app.use(express.json({ limit: '5mb' }));
 app.use('/api/progress', async (req, res, next) => {
  try { const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }); if (!session) return res.status(401).json({ message: 'Sign in to sync your progress.' }); if (req.headers['x-a2z-account-id'] && req.headers['x-a2z-account-id'] !== session.user.id) return res.status(409).json({ message: 'The signed-in account changed in another tab. Sign in again before syncing.' }); res.locals.userId = session.user.id; res.set('Cache-Control', 'no-store'); next(); } catch { res.status(503).json({ message: 'Could not check your session. Try again.' }); }
 });
 app.get('/api/progress', async (req, res, next) => {try {res.json({ progress: await snapshot(res.locals.userId) });}catch(e){next(e)}});
 app.patch('/api/progress', async (req, res) => {
  const changes = req.body?.changes;
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > 1365) return res.status(400).json({ message: 'Send between 1 and 1365 question changes.' });
  for (const change of changes) {
   if (!change || !ids.has(change.id) || !['solved','starred','note'].includes(change.field) || (change.field === 'note' ? typeof change.value !== 'string' || change.value.length > 20000 : typeof change.value !== 'boolean')) return res.status(400).json({ message: 'Invalid question change. Notes are limited to 20,000 characters.' });
  }
  const client = await db.connect();
  try {
   await client.query('BEGIN');
   // Serializes updates for this account while allowing different accounts to save independently.
   await client.query('SELECT id FROM "user" WHERE id = $1 FOR UPDATE', [res.locals.userId]);
   for (const field of ['solved','starred','note']) {
    const latest = [...new Map(changes.filter(c => c.field === field).map(c => [c.id, { id: c.id, value: c.value }])).values()];
    if (!latest.length) continue;
    const type = field === 'note' ? 'text' : 'boolean';
    const value = field === 'note' ? 'x.value' : 'CASE WHEN x.value THEN 1 ELSE 0 END';
    await client.query(`INSERT INTO question_progress (user_id, question_id, ${field}, updated_at)
     SELECT $1, x.id, ${value}, $3 FROM jsonb_to_recordset($2::jsonb) AS x(id text, value ${type})
     ON CONFLICT (user_id, question_id) DO UPDATE SET ${field} = EXCLUDED.${field}, updated_at = EXCLUDED.updated_at`,
     [res.locals.userId, JSON.stringify(latest), new Date().toISOString()]);
   }
   await client.query('COMMIT');
   res.json({ progress: await snapshot(res.locals.userId) });
  } catch { await client.query('ROLLBACK'); res.status(503).json({ message: 'Progress could not be saved. Please retry.' }); }
  finally { client.release(); }
 });
 app.use((error, req, res, next) => res.status(error.status === 413 ? 413 : error.type === 'entity.parse.failed' ? 400 : 503).json({ message: error.status === 413 ? 'This progress upload is too large.' : 'Invalid request.' }));
 return { app, auth, db, close: () => db.end() };
}
