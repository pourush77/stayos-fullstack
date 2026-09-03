import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1D-d: harden the payment ledger. Adds an append-only refund model
 * (type + reversal_of_payment_id) and idempotency protection (idempotency_key
 * unique per folio) to folio_payments. Additive/backward compatible: existing
 * rows default to type='PAYMENT' with NULL reversal/idempotency.
 */
export class HardenFolioPaymentsLedger1786777980000 implements MigrationInterface {
  name = 'HardenFolioPaymentsLedger1786777980000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "folio_payments" ADD COLUMN IF NOT EXISTS "type" varchar(20) NOT NULL DEFAULT 'PAYMENT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "folio_payments" ADD COLUMN IF NOT EXISTS "reversal_of_payment_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "folio_payments" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "folio_payments" ADD CONSTRAINT "FK_folio_payments_reversal" FOREIGN KEY ("reversal_of_payment_id") REFERENCES "folio_payments"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_folio_payments_idempotency" ON "folio_payments" ("folio_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_folio_payments_reversal_of" ON "folio_payments" ("reversal_of_payment_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_folio_payments_reversal_of"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_folio_payments_idempotency"`);
    await queryRunner.query(`ALTER TABLE "folio_payments" DROP CONSTRAINT IF EXISTS "FK_folio_payments_reversal"`);
    await queryRunner.query(`ALTER TABLE "folio_payments" DROP COLUMN IF EXISTS "idempotency_key"`);
    await queryRunner.query(`ALTER TABLE "folio_payments" DROP COLUMN IF EXISTS "reversal_of_payment_id"`);
    await queryRunner.query(`ALTER TABLE "folio_payments" DROP COLUMN IF EXISTS "type"`);
  }
}
