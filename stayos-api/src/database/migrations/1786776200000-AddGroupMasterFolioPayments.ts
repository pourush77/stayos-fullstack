import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupMasterFolioPayments1786776200000 implements MigrationInterface {
  name = 'AddGroupMasterFolioPayments1786776200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "folio_payments"
      ADD COLUMN "group_master_folio_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "folio_payments"
      ALTER COLUMN "folio_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_folio_payments_group_master_folio_id"
      ON "folio_payments" ("group_master_folio_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "folio_payments"
      ADD CONSTRAINT "FK_folio_payments_group_master_folio_id"
      FOREIGN KEY ("group_master_folio_id") REFERENCES "group_master_folios"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "folio_payments"
      ADD CONSTRAINT "CHK_folio_payments_single_folio_owner"
      CHECK (
        ("folio_id" IS NOT NULL AND "group_master_folio_id" IS NULL)
        OR ("folio_id" IS NULL AND "group_master_folio_id" IS NOT NULL)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "folio_payments"
      DROP CONSTRAINT "CHK_folio_payments_single_folio_owner"
    `);
    await queryRunner.query(`
      ALTER TABLE "folio_payments"
      DROP CONSTRAINT "FK_folio_payments_group_master_folio_id"
    `);
    await queryRunner.query(`DROP INDEX "public"."IDX_folio_payments_group_master_folio_id"`);
    await queryRunner.query(`DELETE FROM "folio_payments" WHERE "folio_id" IS NULL`);
    await queryRunner.query(`
      ALTER TABLE "folio_payments"
      ALTER COLUMN "folio_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "folio_payments"
      DROP COLUMN "group_master_folio_id"
    `);
  }
}
