import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1D-a: folio ledger hardening.
 * - folio_charges: add immutable-ledger columns (status POSTED/REVERSED/REVERSAL
 *   + reversal_of_charge_id). Existing rows default to POSTED. History is never
 *   destructively edited; corrections are new REVERSAL rows.
 * - reservation_code_counters-style atomic folio numbering: new
 *   folio_number_counters (one row per property) replaces the racy count()+1.
 *   Backfilled from the MAX trailing-numeric suffix of existing folio_number so
 *   new numbers never collide with historical ones. Additive/backward compatible.
 */
export class HardenFolioLedger20260829090000 implements MigrationInterface {
  name = 'HardenFolioLedger20260829090000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'folio_charges_status_enum') THEN
          CREATE TYPE "public"."folio_charges_status_enum" AS ENUM ('POSTED', 'REVERSED', 'REVERSAL');
        END IF;
      END $$;`,
    );
    await queryRunner.query(
      `ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "status" "public"."folio_charges_status_enum" NOT NULL DEFAULT 'POSTED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "reversal_of_charge_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_folio_charges_reversal_of" ON "folio_charges" ("reversal_of_charge_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "folio_number_counters" (
        "property_id" uuid PRIMARY KEY,
        "last_value" bigint NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_folio_number_counters_property"
          FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_folio_number_counters_nonneg" CHECK ("last_value" >= 0)
      )
    `);
    await queryRunner.query(`
      INSERT INTO "folio_number_counters" ("property_id", "last_value")
      SELECT f."property_id",
             COALESCE(MAX((substring(f."folio_number" from '[0-9]+$'))::bigint), 0)
      FROM "folios" f
      GROUP BY f."property_id"
      ON CONFLICT ("property_id") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "folio_number_counters"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_folio_charges_reversal_of"`);
    await queryRunner.query(`ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "reversal_of_charge_id"`);
    await queryRunner.query(`ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."folio_charges_status_enum"`);
  }
}
