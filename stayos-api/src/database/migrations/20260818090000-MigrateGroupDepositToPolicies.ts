import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes property_policies the authoritative deposit source: backfills a
 * GROUP_DEPOSIT policy row from each property's legacy group-deposit settings
 * (no data loss), then removes the legacy columns to eliminate the dual source
 * of truth.
 */
export class MigrateGroupDepositToPolicies20260818090000 implements MigrationInterface {
  name = 'MigrateGroupDepositToPolicies20260818090000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "property_policies"
        ("property_id", "policy_type", "is_active", "deposit_mode", "deposit_value")
      SELECT
        p."id",
        'GROUP_DEPOSIT',
        true,
        p."group_booking_deposit_policy_type"::text,
        p."group_booking_deposit_policy_value"
      FROM "properties" p
      WHERE NOT EXISTS (
        SELECT 1 FROM "property_policies" pp
        WHERE pp."property_id" = p."id"
          AND pp."policy_type" = 'GROUP_DEPOSIT'
          AND pp."rate_plan_id" IS NULL
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "CHK_properties_group_booking_deposit_policy_value"`,
    );
    await queryRunner.query(
      `ALTER TABLE "properties" DROP COLUMN "group_booking_deposit_policy_value"`,
    );
    await queryRunner.query(
      `ALTER TABLE "properties" DROP COLUMN "group_booking_deposit_policy_type"`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "properties"
      ADD "group_booking_deposit_policy_type" "public"."properties_group_booking_deposit_policy_type_enum" NOT NULL DEFAULT 'NONE'
    `);
    await queryRunner.query(`
      ALTER TABLE "properties"
      ADD "group_booking_deposit_policy_value" numeric(12,2) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      UPDATE "properties" p
      SET
        "group_booking_deposit_policy_type" =
          COALESCE(pp."deposit_mode", 'NONE')::"public"."properties_group_booking_deposit_policy_type_enum",
        "group_booking_deposit_policy_value" = COALESCE(pp."deposit_value", 0)
      FROM "property_policies" pp
      WHERE pp."property_id" = p."id"
        AND pp."policy_type" = 'GROUP_DEPOSIT'
        AND pp."rate_plan_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "properties"
      ADD CONSTRAINT "CHK_properties_group_booking_deposit_policy_value"
      CHECK (
        "group_booking_deposit_policy_value" >= 0
        AND (
          "group_booking_deposit_policy_type" != 'PERCENTAGE'
          OR "group_booking_deposit_policy_value" <= 100
        )
      )
    `);
  }
}
