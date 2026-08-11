import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const configPath = path.resolve(repoRoot, 'drizzle.config.ts');

/**
 * `drizzle.config.ts` reads `process.env.DATABASE_URL` and throws at module-load
 * time when it is missing. Because ES modules are cached per-process, each
 * scenario below is executed in a fresh `node` subprocess so that the
 * presence/absence of DATABASE_URL can be controlled independently per test.
 */
function runConfigInSubprocess(env: Record<string, string | undefined>) {
  const script = `
    import(${JSON.stringify(configPath)})
      .then((m) => {
        process.stdout.write(JSON.stringify({ ok: true, config: m.default }));
      })
      .catch((e) => {
        process.stdout.write(JSON.stringify({ ok: false, message: e.message }));
      });
  `;

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: repoRoot,
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf-8',
  });

  assert.equal(result.status, 0, `subprocess crashed: ${result.stderr}`);
  return JSON.parse(result.stdout.trim());
}

describe('drizzle.config.ts', () => {
  test('throws a descriptive error when DATABASE_URL is not set', () => {
    const output = runConfigInSubprocess({ DATABASE_URL: undefined });
    assert.equal(output.ok, false);
    assert.equal(output.message, 'DATABASE_URL is not set in .env file');
  });

  test('throws when DATABASE_URL is set to an empty string', () => {
    const output = runConfigInSubprocess({ DATABASE_URL: '' });
    assert.equal(output.ok, false);
    assert.equal(output.message, 'DATABASE_URL is not set in .env file');
  });

  test('produces a valid postgresql config when DATABASE_URL is set', () => {
    const url = 'postgres://user:pass@localhost:5432/testdb';
    const output = runConfigInSubprocess({ DATABASE_URL: url });

    assert.equal(output.ok, true);
    assert.deepEqual(output.config, {
      schema: './src/db/schema/index.ts',
      out: './drizzle',
      dialect: 'postgresql',
      dbCredentials: { url },
    });
  });

  test('propagates the exact DATABASE_URL value into dbCredentials.url', () => {
    const url = 'postgres://another-user:secret@example.com:6543/otherdb?sslmode=require';
    const output = runConfigInSubprocess({ DATABASE_URL: url });

    assert.equal(output.ok, true);
    assert.equal(output.config.dbCredentials.url, url);
  });
});