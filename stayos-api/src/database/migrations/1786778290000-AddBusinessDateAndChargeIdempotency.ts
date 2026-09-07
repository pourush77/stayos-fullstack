import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add nullable hotel `business_date` to folio_charges and folio_payments
 * and add idempotency_key + partial unique index to folio_charges.
 * Additive and backward compatible: existing rows remain valid.
 */
export class AddBusinessDateAndChargeIdempotency1786778290000 implements MigrationInterface {
  name = 'AddBusinessDateAndChargeIdempotency1786778290000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "business_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "folio_payments" ADD COLUMN IF NOT EXISTS "business_date" date`,
    );

    await queryRunner.query(
      `ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(120)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_folio_charges_idempotency" ON "folio_charges" ("folio_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_folio_charges_idempotency"`);
    await queryRunner.query(`ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "idempotency_key"`);
    await queryRunner.query(`ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "business_date"`);
    await queryRunner.query(`ALTER TABLE "folio_payments" DROP COLUMN IF EXISTS "business_date"`);
  }
}
