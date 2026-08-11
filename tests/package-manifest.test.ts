import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'));
const lock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf-8'));

describe('package.json', () => {
  test('declares the new database dependencies introduced by this PR', () => {
    assert.equal(pkg.dependencies['@neondatabase/serverless'], '^1.1.0');
    assert.equal(pkg.dependencies['dotenv'], '^17.4.2');
    assert.equal(pkg.dependencies['drizzle-kit'], '^0.31.10');
    assert.equal(pkg.dependencies['drizzle-orm'], '^0.45.2');
  });

  test('declares the db-related npm scripts used to drive drizzle-kit', () => {
    assert.equal(pkg.scripts['db:generate'], 'drizzle-kit generate');
    assert.equal(pkg.scripts['db:migrate'], 'drizzle-kit migrate');
    assert.equal(pkg.scripts['db:run'], 'tsx src/db-example.ts');
  });

  test('is configured as an ESM package', () => {
    assert.equal(pkg.type, 'module');
  });
});

describe('package-lock.json', () => {
  test('is a v3 lockfile for the classroom-backend package', () => {
    assert.equal(lock.lockfileVersion, 3);
    assert.equal(lock.name, 'classroom-backend');
  });

  test('root package entry mirrors package.json name/version', () => {
    const rootEntry = lock.packages[''];
    assert.equal(rootEntry.name, pkg.name);
    assert.equal(rootEntry.version, pkg.version);
  });

  test('every dependency declared in package.json is present in the lockfile root entry', () => {
    const rootEntry = lock.packages[''];
    for (const [name, range] of Object.entries(pkg.dependencies)) {
      assert.equal(rootEntry.dependencies[name], range, `mismatched declared range for ${name}`);
    }
    for (const [name, range] of Object.entries(pkg.devDependencies)) {
      assert.equal(rootEntry.devDependencies[name], range, `mismatched declared range for ${name}`);
    }
  });

  test('locked versions of the new dependencies satisfy the declared semver ranges', () => {
    // Minimal caret-range check (all declared ranges here use `^`) without
    // pulling in an external semver dependency.
    function satisfiesCaret(range: string, version: string): boolean {
      const rangeMatch = range.match(/^\^(\d+)\.(\d+)\.(\d+)/);
      const versionMatch = version.match(/^(\d+)\.(\d+)\.(\d+)/);
      assert.ok(rangeMatch, `expected a caret range, got ${range}`);
      assert.ok(versionMatch, `expected a semver version, got ${version}`);
      const [, rMajor, rMinor, rPatch] = rangeMatch!.map(Number) as unknown as number[];
      const [, vMajor, vMinor, vPatch] = versionMatch!.map(Number) as unknown as number[];
      if (vMajor !== rMajor) return false;
      if (vMinor > rMinor) return true;
      if (vMinor < rMinor) return false;
      return vPatch >= rPatch;
    }

    for (const name of [
      '@neondatabase/serverless',
      'dotenv',
      'drizzle-kit',
      'drizzle-orm',
    ]) {
      const declaredRange = pkg.dependencies[name];
      const lockedVersion = lock.packages[`node_modules/${name}`]?.version;
      assert.ok(lockedVersion, `expected node_modules/${name} to be present in the lockfile`);
      assert.ok(
        satisfiesCaret(declaredRange, lockedVersion),
        `locked version ${lockedVersion} of ${name} does not satisfy declared range ${declaredRange}`,
      );
    }
  });
});

describe('drizzle.config.ts <-> project layout consistency', () => {
  test('the configured schema path exists on disk', () => {
    const configSource = fs.readFileSync(path.join(repoRoot, 'drizzle.config.ts'), 'utf-8');
    assert.match(configSource, /schema: '\.\/src\/db\/schema\/index\.ts'/);
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/db/schema/index.ts')));
  });

  test('the configured output directory contains the generated migration', () => {
    const configSource = fs.readFileSync(path.join(repoRoot, 'drizzle.config.ts'), 'utf-8');
    assert.match(configSource, /out: '\.\/drizzle'/);
    assert.ok(fs.existsSync(path.join(repoRoot, 'drizzle/0000_glossy_redwing.sql')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'drizzle/meta/_journal.json')));
  });
});