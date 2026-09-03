import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePropertyPolicies1786776840000 implements MigrationInterface {
  name = 'CreatePropertyPolicies1786776840000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "property_policies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "rate_plan_id" uuid,
        "policy_type" character varying(32) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "deposit_mode" character varying(16),
        "deposit_value" numeric(12,2),
        "charge_mode" character varying(16),
        "charge_value" numeric(12,2),
        "cancellation_cutoff_hours" integer,
        "grace_minutes" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_property_policies_id" PRIMARY KEY ("id"),

        CONSTRAINT "CHK_property_policies_policy_type" CHECK (
          "policy_type" IN (
            'INDIVIDUAL_DEPOSIT','GROUP_DEPOSIT','CANCELLATION','NO_SHOW','EARLY_CHECK_IN','LATE_CHECKOUT'
          )
        ),
        CONSTRAINT "CHK_property_policies_deposit_mode" CHECK (
          "deposit_mode" IS NULL OR "deposit_mode" IN ('NONE','PERCENTAGE','FIXED_AMOUNT')
        ),
        CONSTRAINT "CHK_property_policies_charge_mode" CHECK (
          "charge_mode" IS NULL OR "charge_mode" IN ('NONE','PERCENTAGE','FIXED_AMOUNT','FIRST_NIGHT')
        ),
        CONSTRAINT "CHK_property_policies_deposit_value" CHECK ("deposit_value" IS NULL OR "deposit_value" >= 0),
        CONSTRAINT "CHK_property_policies_charge_value" CHECK ("charge_value" IS NULL OR "charge_value" >= 0),
        CONSTRAINT "CHK_property_policies_cutoff" CHECK (
          "cancellation_cutoff_hours" IS NULL OR "cancellation_cutoff_hours" >= 0
        ),
        CONSTRAINT "CHK_property_policies_grace" CHECK ("grace_minutes" IS NULL OR "grace_minutes" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_property_policies_property_id" ON "property_policies" ("property_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_property_policies_property_default"
      ON "property_policies" ("property_id", "policy_type")
      WHERE "rate_plan_id" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_property_policies_property_rate_plan"
      ON "property_policies" ("property_id", "policy_type", "rate_plan_id")
      WHERE "rate_plan_id" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "property_policies"
      ADD CONSTRAINT "FK_property_policies_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "property_policies"
      ADD CONSTRAINT "FK_property_policies_rate_plan_id"
      FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "property_policies" DROP CONSTRAINT "FK_property_policies_rate_plan_id"`);
    await queryRunner.query(`ALTER TABLE "property_policies" DROP CONSTRAINT "FK_property_policies_property_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_property_policies_property_rate_plan"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_property_policies_property_default"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_property_policies_property_id"`);
    await queryRunner.query(`DROP TABLE "property_policies"`);
  }
}
