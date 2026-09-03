import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1D-b: link snapshot-driven ROOM charges to the reservation_rate_snapshot
 * that produced them. Nullable columns — legacy/manual charges keep NULL and are
 * therefore never treated as snapshot-driven (never reconciled/overwritten).
 * Additive, backward compatible, no historical recompute.
 */
export class AddFolioChargeSnapshotLink1786777860000 implements MigrationInterface {
  name = 'AddFolioChargeSnapshotLink1786777860000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "rate_snapshot_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "rate_snapshot_version" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_folio_charges_rate_snapshot" ON "folio_charges" ("rate_snapshot_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_folio_charges_rate_snapshot"`);
    await queryRunner.query(`ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "rate_snapshot_version"`);
    await queryRunner.query(`ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "rate_snapshot_id"`);
  }
}
