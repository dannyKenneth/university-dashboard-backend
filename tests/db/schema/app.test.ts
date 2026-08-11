import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createMany, createOne, getTableColumns } from 'drizzle-orm';
import { getTableConfig, PgVarchar, PgInteger, PgTimestamp } from 'drizzle-orm/pg-core';
import {
  departments,
  subjects,
  departmentRelations,
  subjectsRelations,
} from '../../../src/db/schema/app.ts';

describe('schema/app.ts - departments table', () => {
  test('is a pg table named "departments"', () => {
    const config = getTableConfig(departments);
    assert.equal(config.name, 'departments');
  });

  test('has exactly the expected columns', () => {
    const columnNames = Object.keys(getTableColumns(departments)).sort();
    assert.deepEqual(columnNames, ['code', 'createdAt', 'description', 'id', 'name', 'updatedAt']);
  });

  test('id column is an integer primary key, generated always as identity', () => {
    const { id } = departments;
    assert.ok(id instanceof PgInteger);
    assert.equal(id.primary, true);
    assert.equal(id.notNull, true);
    assert.equal(id.generatedIdentity?.type, 'always');
  });

  test('code column is a unique, not-null varchar(50)', () => {
    const { code } = departments;
    assert.ok(code instanceof PgVarchar);
    assert.equal(code.notNull, true);
    assert.equal(code.isUnique, true);
    assert.equal(code.uniqueName, 'departments_code_unique');
    assert.equal(code.length, 50);
  });

  test('name column is a not-null varchar(255) and is not unique', () => {
    const { name } = departments;
    assert.ok(name instanceof PgVarchar);
    assert.equal(name.notNull, true);
    assert.equal(name.isUnique, false);
    assert.equal(name.length, 255);
  });

  test('description column is a nullable varchar(255)', () => {
    const { description } = departments;
    assert.ok(description instanceof PgVarchar);
    assert.equal(description.notNull, false);
    assert.equal(description.length, 255);
  });

  test('createdAt/updatedAt columns are not-null timestamps with a default', () => {
    const { createdAt, updatedAt } = departments;
    assert.ok(createdAt instanceof PgTimestamp);
    assert.equal(createdAt.notNull, true);
    assert.equal(createdAt.hasDefault, true);
    assert.equal(createdAt.name, 'created_at');

    assert.ok(updatedAt instanceof PgTimestamp);
    assert.equal(updatedAt.notNull, true);
    assert.equal(updatedAt.hasDefault, true);
    assert.equal(updatedAt.name, 'updated_at');
    // updatedAt uses $onUpdate(), unlike createdAt.
    assert.equal(typeof updatedAt.onUpdateFn, 'function');
    assert.equal(createdAt.onUpdateFn, undefined);
  });

  test('has no foreign keys and no table-level unique constraints', () => {
    const config = getTableConfig(departments);
    assert.equal(config.foreignKeys.length, 0);
    assert.equal(config.uniqueConstraints.length, 0);
  });
});

describe('schema/app.ts - subjects table', () => {
  test('is a pg table named "subjects"', () => {
    const config = getTableConfig(subjects);
    assert.equal(config.name, 'subjects');
  });

  test('has exactly the expected columns', () => {
    const columnNames = Object.keys(getTableColumns(subjects)).sort();
    assert.deepEqual(columnNames, [
      'code',
      'createdAt',
      'departmentId',
      'description',
      'id',
      'name',
      'updatedAt',
    ]);
  });

  test('id column is an integer primary key, generated always as identity', () => {
    const { id } = subjects;
    assert.ok(id instanceof PgInteger);
    assert.equal(id.primary, true);
    assert.equal(id.notNull, true);
    assert.equal(id.generatedIdentity?.type, 'always');
  });

  test('departmentId is a not-null integer, not itself unique', () => {
    const { departmentId } = subjects;
    assert.ok(departmentId instanceof PgInteger);
    assert.equal(departmentId.notNull, true);
    assert.equal(departmentId.isUnique, false);
    assert.equal(departmentId.name, 'department_id');
  });

  test('declares exactly one foreign key from departmentId to departments.id with onDelete restrict', () => {
    const config = getTableConfig(subjects);
    assert.equal(config.foreignKeys.length, 1);

    const fk = config.foreignKeys[0]!;
    assert.equal(fk.onDelete, 'restrict');

    const ref = fk.reference();
    assert.equal(ref.foreignTable, departments);
    assert.equal(ref.columns[0], subjects.departmentId);
    assert.equal(ref.foreignColumns[0], departments.id);
  });

  test('code column is a unique, not-null varchar(50)', () => {
    const { code } = subjects;
    assert.ok(code instanceof PgVarchar);
    assert.equal(code.notNull, true);
    assert.equal(code.isUnique, true);
    assert.equal(code.uniqueName, 'subjects_code_unique');
    assert.equal(code.length, 50);
  });

  test('name column is a not-null varchar(255)', () => {
    const { name } = subjects;
    assert.ok(name instanceof PgVarchar);
    assert.equal(name.notNull, true);
    assert.equal(name.length, 255);
  });

  test('description column is a nullable varchar(255)', () => {
    const { description } = subjects;
    assert.ok(description instanceof PgVarchar);
    assert.equal(description.notNull, false);
  });

  test('has no table-level unique constraints (uniqueness is column-level)', () => {
    const config = getTableConfig(subjects);
    assert.equal(config.uniqueConstraints.length, 0);
  });
});

describe('schema/app.ts - relations', () => {
  test('departmentRelations is bound to the departments table', () => {
    assert.equal(departmentRelations.table, departments);
  });

  test('departmentRelations declares "subjects" as a many-relation to the subjects table', () => {
    const helpers = { one: createOne(departments), many: createMany(departments) };
    const result = departmentRelations.config(helpers);

    assert.deepEqual(Object.keys(result), ['subjects']);
    assert.equal(result.subjects.referencedTable, subjects);
    assert.equal(result.subjects.sourceTable, departments);
  });

  test('subjectsRelations is bound to the subjects table', () => {
    assert.equal(subjectsRelations.table, subjects);
  });

  test('subjectsRelations declares "department" as a one-relation to the departments table', () => {
    const helpers = { one: createOne(subjects), many: createMany(subjects) };
    const result = subjectsRelations.config(helpers);

    assert.deepEqual(Object.keys(result), ['department']);
    assert.equal(result.department.referencedTable, departments);
    assert.equal(result.department.sourceTable, subjects);
  });
});