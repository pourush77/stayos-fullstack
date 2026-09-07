import { QueryRunner } from 'typeorm';
import { WidenFolioChargeIdempotencyKey1786778310000 } from '../../migrations/1786778310000-WidenFolioChargeIdempotencyKey';

describe('WidenFolioChargeIdempotencyKey1786778310000', () => {
  let migration: WidenFolioChargeIdempotencyKey1786778310000;
  let queryMock: jest.Mock;

  beforeEach(() => {
    migration = new WidenFolioChargeIdempotencyKey1786778310000();
    queryMock = jest.fn().mockResolvedValue(undefined);
  });

  it('widens folio charge idempotency keys for deterministic room-night keys', async () => {
    await migration.up({ query: queryMock } as Partial<QueryRunner> as QueryRunner);

    expect(queryMock).toHaveBeenCalledWith(
      'ALTER TABLE "folio_charges" ALTER COLUMN "idempotency_key" TYPE varchar(240)',
    );
  });

  it('restores the previous column width on down migration', async () => {
    await migration.down({ query: queryMock } as Partial<QueryRunner> as QueryRunner);

    expect(queryMock).toHaveBeenCalledWith(
      'ALTER TABLE "folio_charges" ALTER COLUMN "idempotency_key" TYPE varchar(120)',
    );
  });
});
