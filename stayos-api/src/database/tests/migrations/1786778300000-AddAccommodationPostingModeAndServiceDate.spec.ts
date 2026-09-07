import { QueryRunner } from 'typeorm';
import { AddAccommodationPostingModeAndServiceDate1786778300000 } from '../../migrations/1786778300000-AddAccommodationPostingModeAndServiceDate';

describe('AddAccommodationPostingModeAndServiceDate1786778300000', () => {
  let migration: AddAccommodationPostingModeAndServiceDate1786778300000;
  let mockQueryRunner: Partial<QueryRunner>;
  let queryMock: jest.Mock;

  beforeEach(() => {
    migration = new AddAccommodationPostingModeAndServiceDate1786778300000();
    queryMock = jest.fn().mockResolvedValue(undefined);
    mockQueryRunner = {
      query: queryMock,
    };
  });

  it('adds a constrained reservation posting mode and backfills existing reservations upfront', async () => {
    await migration.up(mockQueryRunner as QueryRunner);

    expect(queryMock).toHaveBeenCalledTimes(6);
    expect(queryMock.mock.calls[0][0]).toContain(
      'CREATE TYPE "public"."reservations_accommodation_posting_mode_enum"',
    );
    expect(queryMock.mock.calls[0][0]).toContain("'UPFRONT_FULL_STAY'");
    expect(queryMock.mock.calls[0][0]).toContain("'NIGHTLY_V1'");
    expect(queryMock.mock.calls[1][0]).toBe(
      'ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "accommodation_posting_mode" "public"."reservations_accommodation_posting_mode_enum"',
    );
    expect(queryMock.mock.calls[2][0]).toBe(
      'UPDATE "reservations" SET "accommodation_posting_mode" = \'UPFRONT_FULL_STAY\' WHERE "accommodation_posting_mode" IS NULL',
    );
    expect(queryMock.mock.calls[3][0]).toBe(
      'ALTER TABLE "reservations" ALTER COLUMN "accommodation_posting_mode" SET DEFAULT \'UPFRONT_FULL_STAY\'',
    );
    expect(queryMock.mock.calls[4][0]).toBe(
      'ALTER TABLE "reservations" ALTER COLUMN "accommodation_posting_mode" SET NOT NULL',
    );
  });

  it('adds nullable service_date to folio_charges without historical backfill', async () => {
    await migration.up(mockQueryRunner as QueryRunner);

    expect(queryMock.mock.calls[5][0]).toBe(
      'ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "service_date" date',
    );

    const migrationSql = queryMock.mock.calls.map(([sql]) => sql).join('\n');
    expect(migrationSql).not.toContain('UPDATE "folio_charges"');
    expect(migrationSql).not.toContain('"service_date" =');
    expect(migrationSql).not.toContain('"service_date" SET NOT NULL');
  });

  it('drops service_date, posting mode, and enum on down migration', async () => {
    await migration.down(mockQueryRunner as QueryRunner);

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[0][0]).toBe(
      'ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "service_date"',
    );
    expect(queryMock.mock.calls[1][0]).toBe(
      'ALTER TABLE "reservations" DROP COLUMN IF EXISTS "accommodation_posting_mode"',
    );
    expect(queryMock.mock.calls[2][0]).toBe(
      'DROP TYPE IF EXISTS "public"."reservations_accommodation_posting_mode_enum"',
    );
  });
});
