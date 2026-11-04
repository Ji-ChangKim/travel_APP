import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { repositoryPath } from '../shared/repository-paths.cjs';

// 원격 자원과 분리한 영구 로컬 DB/R2만 Android Studio 검수에 연결한다.
const root = repositoryPath('outputs/android-studio-local');
await mkdir(root, { recursive: true });
const secretPath = `${root}/auth-secret.txt`;
let secret;
try {
  secret = await readFile(secretPath, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  secret = randomBytes(48).toString('hex');
  await writeFile(secretPath, secret, { flag: 'wx' });
}
await new Promise((resolve, reject) => {
  const child = spawn(
    process.execPath,
    [
      repositoryPath('apps/api/node_modules/wrangler/bin/wrangler.js'),
      'deploy',
      '--dry-run',
      '--env',
      'staging',
      '--outdir',
      '.release/studio-local',
    ],
    {
      cwd: repositoryPath('apps/api'),
      stdio: 'inherit',
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    },
  );
  child.once('error', reject);
  child.once('exit', (code) =>
    code === 0 ? resolve() : reject(new Error('로컬 API 빌드에 실패했습니다.')),
  );
});
const require = createRequire(repositoryPath('apps/api/package.json'));
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const mf = new Miniflare(
  convertV4MiniflareOptions({
    port: 8787,
    host: '127.0.0.1',
    d1Persist: `${root}/d1`,
    r2Persist: `${root}/r2`,
    workers: [
      {
        name: 'tripprint-studio-local',
        modules: true,
        scriptPath: repositoryPath('apps/api/.release/studio-local/index.js'),
        compatibilityDate: '2026-10-02',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: { DB: 'studio-local' },
        r2Buckets: ['MEDIA'],
        bindings: {
          AUTH_SECRET: secret,
          AUTH_BASE_URL: 'http://127.0.0.1:8787',
          ALLOWED_ORIGINS:
            'http://127.0.0.1:8081,http://localhost:8081,travelapp://',
          GOOGLE_CLIENT_ID: process.env.TRIPPRINT_STUDIO_GOOGLE_CLIENT_ID || '',
          GOOGLE_CLIENT_SECRET:
            process.env.TRIPPRINT_STUDIO_GOOGLE_CLIENT_SECRET || '',
          APP_UPDATE_POLICY_JSON: '',
          SUPABASE_URL: '',
          SUPABASE_ANON_KEY: '',
        },
      },
    ],
  }),
);
const db = await mf.getD1Database('DB');
await db
  .prepare(
    'CREATE TABLE IF NOT EXISTS studio_migrations (name TEXT PRIMARY KEY)',
  )
  .run();
for (const name of (await readdir(repositoryPath('apps/api/migrations')))
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  if (
    await db
      .prepare('SELECT name FROM studio_migrations WHERE name=?')
      .bind(name)
      .first()
  )
    continue;
  const sql = await readFile(
    repositoryPath(`apps/api/migrations/${name}`),
    'utf8',
  );
  const statements = sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .filter((sql) => sql.trim())
    .map((sql) => db.prepare(sql));
  await db.batch([
    ...statements,
    db.prepare('INSERT INTO studio_migrations(name) VALUES(?)').bind(name),
  ]);
}
await mf.ready;
console.log(
  'Android Studio 로컬 API: http://127.0.0.1:8787 (로컬 DB·파일 저장소, ' +
    (process.env.TRIPPRINT_STUDIO_GOOGLE_CLIENT_ID &&
    process.env.TRIPPRINT_STUDIO_GOOGLE_CLIENT_SECRET
      ? 'Google 설정 입력됨'
      : 'Google 인증 미설정') +
    ')',
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await mf.dispose();
    process.exit(0);
  });
