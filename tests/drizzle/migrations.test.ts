import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const drizzleDir = path.join(repoRoot, 'drizzle');
const migrationSqlPath = path.join(drizzleDir, '0000_glossy_redwing.sql');
const journalPath = path.join(drizzleDir, 'meta', '_journal.json');
const snapshotPath = path.join(drizzleDir, 'meta', '0000_snapshot.json');

const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
const migrationSql = fs.readFileSync(migrationSqlPath, 'utf-8');

describe('drizzle/meta/_journal.json', () => {
  test('declares the postgresql dialect and version 7', () => {
    assert.equal(journal.dialect, 'postgresql');
    assert.equal(journal.version, '7');
  });

  test('has exactly one entry pointing at the 0000 migration', () => {
    assert.equal(journal.entries.length, 1);
    const [entry] = journal.entries;
    assert.equal(entry.idx, 0);
    assert.equal(entry.tag, '0000_glossy_redwing');
    assert.equal(entry.breakpoints, true);
    assert.equal(typeof entry.when, 'number');
  });

  test('every journal entry has a corresponding .sql file on disk', () => {
    for (const entry of journal.entries) {
      const sqlFile = path.join(drizzleDir, `${entry.tag}.sql`);
      assert.ok(fs.existsSync(sqlFile), `expected migration file ${sqlFile} to exist`);
    }
  });
});

describe('drizzle/meta/0000_snapshot.json', () => {
  test('is versioned as postgresql dialect, schema version 7, with no previous migration', () => {
    assert.equal(snapshot.dialect, 'postgresql');
    assert.equal(snapshot.version, '7');
    assert.equal(snapshot.prevId, '00000000-0000-0000-0000-000000000000');
    assert.match(snapshot.id, /^[0-9a-f-]{36}$/);
  });

  test('declares exactly the departments and subjects tables', () => {
    assert.deepEqual(Object.keys(snapshot.tables).sort(), ['public.departments', 'public.subjects']);
  });

  test('departments table matches the expected column shape', () => {
    const table = snapshot.tables['public.departments'];
    assert.equal(table.name, 'departments');
    assert.deepEqual(Object.keys(table.columns).sort(), [
      'code',
      'created_at',
      'description',
      'id',
      'name',
      'updated_at',
    ]);

    assert.equal(table.columns.id.primaryKey, true);
    assert.equal(table.columns.id.identity.type, 'always');
    assert.equal(table.columns.code.type, 'varchar(50)');
    assert.equal(table.columns.code.notNull, true);
    assert.equal(table.columns.description.notNull, false);

    assert.deepEqual(Object.keys(table.uniqueConstraints), ['departments_code_unique']);
    assert.deepEqual(table.uniqueConstraints.departments_code_unique.columns, ['code']);
    assert.deepEqual(table.foreignKeys, {});
  });

  test('subjects table matches the expected column shape and foreign key', () => {
    const table = snapshot.tables['public.subjects'];
    assert.equal(table.name, 'subjects');
    assert.deepEqual(Object.keys(table.columns).sort(), [
      'code',
      'created_at',
      'department_id',
      'description',
      'id',
      'name',
      'updated_at',
    ]);

    assert.deepEqual(Object.keys(table.uniqueConstraints), ['subjects_code_unique']);

    const fkKey = 'subjects_department_id_departments_id_fk';
    assert.deepEqual(Object.keys(table.foreignKeys), [fkKey]);

    const fk = table.foreignKeys[fkKey];
    assert.equal(fk.tableFrom, 'subjects');
    assert.equal(fk.tableTo, 'departments');
    assert.deepEqual(fk.columnsFrom, ['department_id']);
    assert.deepEqual(fk.columnsTo, ['id']);
    assert.equal(fk.onDelete, 'restrict');
    assert.equal(fk.onUpdate, 'no action');
  });

  test('neither table declares row-level security', () => {
    for (const table of Object.values(snapshot.tables) as any[]) {
      assert.equal(table.isRLSEnabled, false);
    }
  });
});

describe('drizzle/0000_glossy_redwing.sql', () => {
  test('creates the departments table with a unique code constraint', () => {
    assert.match(migrationSql, /CREATE TABLE "departments"/);
    assert.match(migrationSql, /CONSTRAINT "departments_code_unique" UNIQUE\("code"\)/);
  });

  test('creates the subjects table with a unique code constraint', () => {
    assert.match(migrationSql, /CREATE TABLE "subjects"/);
    assert.match(migrationSql, /CONSTRAINT "subjects_code_unique" UNIQUE\("code"\)/);
  });

  test('adds the department_id foreign key with ON DELETE restrict', () => {
    assert.match(
      migrationSql,
      /ALTER TABLE "subjects" ADD CONSTRAINT "subjects_department_id_departments_id_fk" FOREIGN KEY \("department_id"\) REFERENCES "public"\."departments"\("id"\) ON DELETE restrict ON UPDATE no action;/,
    );
  });

  test('departments table is created before subjects (FK ordering)', () => {
    const departmentsIndex = migrationSql.indexOf('CREATE TABLE "departments"');
    const subjectsIndex = migrationSql.indexOf('CREATE TABLE "subjects"');
    const fkIndex = migrationSql.indexOf('ADD CONSTRAINT "subjects_department_id_departments_id_fk"');

    assert.ok(departmentsIndex >= 0 && subjectsIndex >= 0 && fkIndex >= 0);
    assert.ok(departmentsIndex < subjectsIndex);
    assert.ok(subjectsIndex < fkIndex);
  });
});