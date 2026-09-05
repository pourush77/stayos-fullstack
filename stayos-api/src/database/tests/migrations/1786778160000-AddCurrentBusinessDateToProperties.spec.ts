import { QueryRunner } from 'typeorm';
import { AddCurrentBusinessDateToProperties1786778160000 } from '../../migrations/1786778160000-AddCurrentBusinessDateToProperties';

describe('AddCurrentBusinessDateToProperties1786778160000', () => {
  let migration: AddCurrentBusinessDateToProperties1786778160000;
  let mockQueryRunner: Partial<QueryRunner>;
  let queryMock: jest.Mock;

  beforeEach(() => {
    migration = new AddCurrentBusinessDateToProperties1786778160000();
    queryMock = jest.fn().mockResolvedValue(undefined);
    mockQueryRunner = {
      query: queryMock,
    };
  });

  it('runs up migration in 3 steps: add column, backfill with cutoff semantics, set not null', async () => {
    await migration.up(mockQueryRunner as QueryRunner);

    expect(queryMock).toHaveBeenCalledTimes(3);

    // 1. Column creation (nullable initially)
    const addColumnSql = queryMock.mock.calls[0][0];
    expect(addColumnSql).toContain('ALTER TABLE "properties"');
    expect(addColumnSql).toContain('ADD COLUMN IF NOT EXISTS "current_business_date" date');

    // 2. Cutoff-aware timezone backfill
    const backfillSql = queryMock.mock.calls[1][0];
    expect(backfillSql).toContain('UPDATE "properties"');
    expect(backfillSql).toContain('CURRENT_TIMESTAMP AT TIME ZONE "timezone"');
    expect(backfillSql).toContain('COALESCE("business_day_cut_off_time", \'00:00:00\'::time)');
    expect(backfillSql).toContain("INTERVAL '1 day'");
    expect(backfillSql).toContain('WHERE "current_business_date" IS NULL');

    // 3. Set NOT NULL
    const setNotNullSql = queryMock.mock.calls[2][0];
    expect(setNotNullSql).toContain('ALTER TABLE "properties"');
    expect(setNotNullSql).toContain('ALTER COLUMN "current_business_date" SET NOT NULL');
  });

  it('runs down migration to drop current_business_date column', async () => {
    await migration.down(mockQueryRunner as QueryRunner);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const dropSql = queryMock.mock.calls[0][0];
    expect(dropSql).toContain('ALTER TABLE "properties"');
    expect(dropSql).toContain('DROP COLUMN IF EXISTS "current_business_date"');
  });
});
