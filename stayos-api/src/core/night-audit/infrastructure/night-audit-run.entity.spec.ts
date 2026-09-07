import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { NightAuditRunEntity } from './night-audit-run.entity';

describe('NightAuditRunEntity', () => {
  it('maps nullable completion snapshot columns', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (column) => column.target === NightAuditRunEntity,
    );

    const completionSnapshot = columns.find(
      (column) => column.propertyName === 'completionSnapshot',
    );
    const completionSnapshotVersion = columns.find(
      (column) => column.propertyName === 'completionSnapshotVersion',
    );

    expect(completionSnapshot?.options).toMatchObject({
      type: 'jsonb',
      name: 'completion_snapshot',
      nullable: true,
    });
    expect(completionSnapshotVersion?.options).toMatchObject({
      type: 'varchar',
      name: 'completion_snapshot_version',
      nullable: true,
    });
  });
});
