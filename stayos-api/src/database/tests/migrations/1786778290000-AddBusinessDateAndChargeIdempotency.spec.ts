import { QueryRunner } from 'typeorm';
import { AddBusinessDateAndChargeIdempotency1786778290000 } from '../../migrations/1786778290000-AddBusinessDateAndChargeIdempotency';

describe('AddBusinessDateAndChargeIdempotency1786778290000', () => {
  let migration: AddBusinessDateAndChargeIdempotency1786778290000;
  let mockQueryRunner: Partial<QueryRunner>;
  let queryMock: jest.Mock;

  beforeEach(() => {
    migration = new AddBusinessDateAndChargeIdempotency1786778290000();
    queryMock = jest.fn().mockResolvedValue(undefined);
    mockQueryRunner = {
      query: queryMock,
    };
  });

  it('adds nullable business_date columns and charge idempotency without defaults/backfill', async () => {
    await migration.up(mockQueryRunner as QueryRunner);

    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(queryMock.mock.calls[0][0]).toBe(
      'ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "business_date" date',
    );
    expect(queryMock.mock.calls[1][0]).toBe(
      'ALTER TABLE "folio_payments" ADD COLUMN IF NOT EXISTS "business_date" date',
    );
    expect(queryMock.mock.calls[2][0]).toBe(
      'ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(120)',
    );
    expect(queryMock.mock.calls[3][0]).toBe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_folio_charges_idempotency" ON "folio_charges" ("folio_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL',
    );

    const migrationSql = queryMock.mock.calls.map(([sql]) => sql).join('\n');
    expect(migrationSql).not.toContain('DEFAULT');
    expect(migrationSql).not.toContain('UPDATE "folio_charges"');
    expect(migrationSql).not.toContain('UPDATE "folio_payments"');
  });

  it('drops index and columns on down migration', async () => {
    await migration.down(mockQueryRunner as QueryRunner);

    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(queryMock.mock.calls[0][0]).toBe('DROP INDEX IF EXISTS "UQ_folio_charges_idempotency"');
    expect(queryMock.mock.calls[1][0]).toBe(
      'ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "idempotency_key"',
    );
    expect(queryMock.mock.calls[2][0]).toBe(
      'ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "business_date"',
    );
    expect(queryMock.mock.calls[3][0]).toBe(
      'ALTER TABLE "folio_payments" DROP COLUMN IF EXISTS "business_date"',
    );
  });
});
