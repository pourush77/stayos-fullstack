import { QueryRunner } from 'typeorm';
import { CreateNightAuditRunsTable1786778220000 } from '../../migrations/1786778220000-CreateNightAuditRunsTable';

describe('CreateNightAuditRunsTable1786778220000', () => {
  let migration: CreateNightAuditRunsTable1786778220000;
  let mockQueryRunner: Partial<QueryRunner>;
  let queryMock: jest.Mock;

  beforeEach(() => {
    migration = new CreateNightAuditRunsTable1786778220000();
    queryMock = jest.fn().mockResolvedValue(undefined);
    mockQueryRunner = {
      query: queryMock,
    };
  });

  it('runs up migration creating enum, table with unique property/business_date, and partial unique index on open runs', async () => {
    await migration.up(mockQueryRunner as QueryRunner);

    expect(queryMock).toHaveBeenCalledTimes(3);

    // 1. Enum creation
    const enumSql = queryMock.mock.calls[0][0];
    expect(enumSql).toContain('CREATE TYPE "public"."night_audit_runs_status_enum"');
    expect(enumSql).toContain("'OPEN'");
    expect(enumSql).toContain("'COMPLETED'");

    // 2. Table creation
    const tableSql = queryMock.mock.calls[1][0];
    expect(tableSql).toContain('CREATE TABLE "night_audit_runs"');
    expect(tableSql).toContain('"business_date" date NOT NULL');
    expect(tableSql).toContain(
      '"status" "public"."night_audit_runs_status_enum" NOT NULL DEFAULT \'OPEN\'',
    );
    expect(tableSql).toContain(
      'CONSTRAINT "UQ_night_audit_runs_property_business_date" UNIQUE ("property_id", "business_date")',
    );

    // 3. Partial unique index for OPEN status
    const indexSql = queryMock.mock.calls[2][0];
    expect(indexSql).toContain('CREATE UNIQUE INDEX "UQ_night_audit_runs_property_open"');
    expect(indexSql).toContain('ON "night_audit_runs" ("property_id")');
    expect(indexSql).toContain('WHERE "status" = \'OPEN\'');
  });

  it('runs down migration dropping index, table, and enum', async () => {
    await migration.down(mockQueryRunner as QueryRunner);

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[0][0]).toContain(
      'DROP INDEX IF EXISTS "UQ_night_audit_runs_property_open"',
    );
    expect(queryMock.mock.calls[1][0]).toContain('DROP TABLE IF EXISTS "night_audit_runs"');
    expect(queryMock.mock.calls[2][0]).toContain(
      'DROP TYPE IF EXISTS "public"."night_audit_runs_status_enum"',
    );
  });
});
