// NOTE: `src/db-example.ts` imports from directory specifiers ('./db', './schema')
// without file extensions, which requires a loader capable of mapping these back
// to their TypeScript sources (e.g. tsx). Run this suite with:
//   node --import tsx/esm --test tests/db-example.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const dbExamplePath = path.resolve(repoRoot, 'src/db-example.ts');

function runDbExampleInSubprocess() {
  // Importing db-example.ts immediately invokes main(), which performs live
  // database CRUD operations. We only want to observe whether the module
  // *resolves*, without ever letting main() run and attempt network I/O, so
  // this is executed as an isolated subprocess whose import is expected to
  // reject before main() executes.
  const script = `
    import(${JSON.stringify(dbExamplePath)})
      .then(() => {
        process.stdout.write(JSON.stringify({ ok: true }));
      })
      .catch((e) => {
        process.stdout.write(JSON.stringify({ ok: false, code: e.code, message: e.message }));
      });
  `;

  return spawnSync(process.execPath, ['--import', 'tsx/esm', '--input-type=module', '-e', script], {
    cwd: repoRoot,
    env: { PATH: process.env.PATH },
    encoding: 'utf-8',
  });
}

describe('src/db-example.ts', () => {
  test('currently fails to resolve its "./schema" import (regression/characterization test)', () => {
    // src/db-example.ts is located at src/db-example.ts and imports `from
    // './schema'`, which resolves relative to src/ (i.e. `src/schema`).
    // The actual schema module lives at `src/db/schema`, so this import path
    // is broken as written. This test documents the current failure mode; if
    // the import path is fixed, this test should be updated to assert
    // successful resolution instead.
    const result = runDbExampleInSubprocess();
    assert.equal(result.status, 0, `subprocess crashed unexpectedly: ${result.stderr}`);

    const output = JSON.parse(result.stdout.trim());
    assert.equal(output.ok, false);
    assert.equal(output.code, 'ERR_MODULE_NOT_FOUND');
    assert.match(output.message, /schema/);
  });
});