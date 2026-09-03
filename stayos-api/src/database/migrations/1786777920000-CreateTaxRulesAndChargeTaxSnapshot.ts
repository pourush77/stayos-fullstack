import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1D-c: configurable, effective-dated Indian GST rules (tax_rules) plus a
 * frozen per-line tax snapshot on folio_charges (hsn_sac scalar + tax_snapshot
 * JSONB with the CGST/SGST/IGST breakdown that applied when the charge was
 * posted). Additive and backward compatible: existing charges keep NULL tax
 * snapshot; the engine ships EMPTY (no rules) so GST is zero until configured.
 */
export class CreateTaxRulesAndChargeTaxSnapshot1786777920000 implements MigrationInterface {
  name = 'CreateTaxRulesAndChargeTaxSnapshot1786777920000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tax_rules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "property_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "charge_type" varchar(40) NOT NULL,
        "hsn_sac" varchar(16),
        "tax_percentage" numeric(5,2) NOT NULL,
        "slab_min_amount" numeric(12,2),
        "slab_max_amount" numeric(12,2),
        "effective_from" date NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tax_rules" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_tax_rules_percentage_range" CHECK ("tax_percentage" >= 0 AND "tax_percentage" <= 100),
        CONSTRAINT "CHK_tax_rules_slab_bounds" CHECK ("slab_min_amount" IS NULL OR "slab_max_amount" IS NULL OR "slab_min_amount" <= "slab_max_amount"),
        CONSTRAINT "FK_tax_rules_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tax_rules_lookup" ON "tax_rules" ("property_id", "charge_type", "is_active")`,
    );
    await queryRunner.query(`ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "hsn_sac" varchar(16)`);
    await queryRunner.query(`ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "tax_snapshot" jsonb`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "tax_snapshot"`);
    await queryRunner.query(`ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "hsn_sac"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tax_rules_lookup"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_rules"`);
  }
}
