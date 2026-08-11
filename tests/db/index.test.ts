import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const dbIndexPath = path.resolve(repoRoot, 'src/db/index.ts');

/**
 * `src/db/index.ts` reads `process.env.DATABASE_URL` and throws at module-load
 * time when it is missing. Because ES modules are cached per-process, each
 * scenario below runs in a fresh `node` subprocess.
 */
function runDbModuleInSubprocess(env: Record<string, string | undefined>) {
  const script = `
    import(${JSON.stringify(dbIndexPath)})
      .then((m) => {
        process.stdout.write(JSON.stringify({
          ok: true,
          hasDb: Boolean(m.db),
          dbMethods: ['select', 'insert', 'update', 'delete'].filter((k) => typeof m.db[k] === 'function'),
        }));
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

describe('src/db/index.ts', () => {
  test('throws "DATABASE_URL is not defined" when the env var is missing', () => {
    const output = runDbModuleInSubprocess({ DATABASE_URL: undefined });
    assert.equal(output.ok, false);
    assert.equal(output.message, 'DATABASE_URL is not defined');
  });

  test('throws when DATABASE_URL is an empty string', () => {
    const output = runDbModuleInSubprocess({ DATABASE_URL: '' });
    assert.equal(output.ok, false);
    assert.equal(output.message, 'DATABASE_URL is not defined');
  });

  test('exports a drizzle db client exposing the query builder API when DATABASE_URL is set', () => {
    const output = runDbModuleInSubprocess({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb',
    });

    assert.equal(output.ok, true);
    assert.equal(output.hasDb, true);
    assert.deepEqual(output.dbMethods.sort(), ['delete', 'insert', 'select', 'update']);
  });
});