import { QueryRunner } from 'typeorm';
import { AddNightlyServiceDateUniqueIndex1786778320000 } from '../../migrations/1786778320000-AddNightlyServiceDateUniqueIndex';

describe('AddNightlyServiceDateUniqueIndex1786778320000', () => {
  let migration: AddNightlyServiceDateUniqueIndex1786778320000;
  let queryMock: jest.Mock;

  beforeEach(() => {
    migration = new AddNightlyServiceDateUniqueIndex1786778320000();
    queryMock = jest.fn().mockResolvedValue(undefined);
  });

  it('creates a partial unique index over (folio_id, service_date) for LIVE nightly ROOM charges only', async () => {
    await migration.up({ query: queryMock } as Partial<QueryRunner> as QueryRunner);

    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toContain('CREATE UNIQUE INDEX');
    expect(sql).toContain('"UQ_folio_charges_nightly_service_date"');
    expect(sql).toContain('ON "folio_charges" ("folio_id", "service_date")');
    // Predicate excludes NULL service_date, non-ROOM, and non-POSTED (reversals).
    expect(sql).toContain(`"service_date" IS NOT NULL`);
    expect(sql).toContain(`"type" = 'ROOM'`);
    expect(sql).toContain(`"status" = 'POSTED'`);
  });

  it('drops only the new index on down migration', async () => {
    await migration.down({ query: queryMock } as Partial<QueryRunner> as QueryRunner);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "UQ_folio_charges_nightly_service_date"',
    );
  });
});
