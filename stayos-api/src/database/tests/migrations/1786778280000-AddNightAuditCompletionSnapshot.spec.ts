import { QueryRunner } from 'typeorm';
import { AddNightAuditCompletionSnapshot1786778280000 } from '../../migrations/1786778280000-AddNightAuditCompletionSnapshot';

describe('AddNightAuditCompletionSnapshot1786778280000', () => {
  let migration: AddNightAuditCompletionSnapshot1786778280000;
  let mockQueryRunner: Partial<QueryRunner>;
  let queryMock: jest.Mock;

  beforeEach(() => {
    migration = new AddNightAuditCompletionSnapshot1786778280000();
    queryMock = jest.fn().mockResolvedValue(undefined);
    mockQueryRunner = {
      query: queryMock,
    };
  });

  it('adds nullable completion snapshot columns without defaults or backfill', async () => {
    await migration.up(mockQueryRunner as QueryRunner);

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][0]).toBe(
      'ALTER TABLE "night_audit_runs" ADD COLUMN "completion_snapshot" jsonb',
    );
    expect(queryMock.mock.calls[1][0]).toBe(
      'ALTER TABLE "night_audit_runs" ADD COLUMN "completion_snapshot_version" varchar',
    );

    const migrationSql = queryMock.mock.calls.map(([sql]) => sql).join('\n');
    expect(migrationSql).not.toContain('DEFAULT');
    expect(migrationSql).not.toContain('UPDATE "night_audit_runs"');
  });

  it('drops completion snapshot columns on down migration', async () => {
    await migration.down(mockQueryRunner as QueryRunner);

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][0]).toBe(
      'ALTER TABLE "night_audit_runs" DROP COLUMN "completion_snapshot_version"',
    );
    expect(queryMock.mock.calls[1][0]).toBe(
      'ALTER TABLE "night_audit_runs" DROP COLUMN "completion_snapshot"',
    );
  });
});
