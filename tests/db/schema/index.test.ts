// NOTE: This file re-exports from './app.js' (an extensionless-relative-to-tsc-output
// specifier). It can only be resolved by a loader that maps '.js' back to '.ts'
// sources (e.g. tsx, or a prior `tsc` build). Run this suite with:
//   node --import tsx/esm --test tests/db/schema/index.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as appModule from '../../../src/db/schema/app.ts';
import * as indexModule from '../../../src/db/schema/index.ts';

describe('schema/index.ts', () => {
  test('re-exports everything exported by ./app.ts, and nothing else', () => {
    assert.deepEqual(Object.keys(indexModule).sort(), Object.keys(appModule).sort());
  });

  test('re-exported bindings are referentially identical to the originals', () => {
    assert.equal(indexModule.departments, appModule.departments);
    assert.equal(indexModule.subjects, appModule.subjects);
    assert.equal(indexModule.departmentRelations, appModule.departmentRelations);
    assert.equal(indexModule.subjectsRelations, appModule.subjectsRelations);
  });
});