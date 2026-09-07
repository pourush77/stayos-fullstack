import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNightAuditCompletionSnapshot1786778280000 implements MigrationInterface {
  name = 'AddNightAuditCompletionSnapshot1786778280000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "night_audit_runs" ADD COLUMN "completion_snapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "night_audit_runs" ADD COLUMN "completion_snapshot_version" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "night_audit_runs" DROP COLUMN "completion_snapshot_version"`,
    );
    await queryRunner.query(`ALTER TABLE "night_audit_runs" DROP COLUMN "completion_snapshot"`);
  }
}
