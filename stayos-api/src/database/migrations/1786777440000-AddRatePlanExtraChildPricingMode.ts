import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the RATE_PLAN_EXTRA_CHILD value to the child age-band pricing mode enum.
 * A band assigned this mode is priced from the applicable rate plan's
 * extra_child_charge (single authoritative child-pricing mechanism). Additive
 * and backward compatible: existing bands keep their modes and pricing.
 */
export class AddRatePlanExtraChildPricingMode1786777440000 implements MigrationInterface {
  name = 'AddRatePlanExtraChildPricingMode1786777440000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = 'RATE_PLAN_EXTRA_CHILD'
            AND enumtypid = 'public.child_age_bands_pricing_mode_enum'::regtype
        ) THEN
          ALTER TYPE "public"."child_age_bands_pricing_mode_enum" ADD VALUE 'RATE_PLAN_EXTRA_CHILD';
        END IF;
      END
      $$;
    `);
  }

  async down(): Promise<void> {
    // PostgreSQL cannot safely remove an enum value without recreating the type.
  }
}
