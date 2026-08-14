import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuestPricingPolicies20260814090000 implements MigrationInterface {
  name = 'CreateGuestPricingPolicies20260814090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."child_age_bands_pricing_mode_enum"
      AS ENUM(
        'FREE',
        'FIXED_PER_NIGHT',
        'PERCENT_OF_ROOM_RATE',
        'ADULT_PRICING'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "guest_pricing_policies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "age_based_child_pricing_enabled" boolean NOT NULL DEFAULT true,
        "maximum_child_age" integer NOT NULL DEFAULT 17,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_guest_pricing_policies_id"
          PRIMARY KEY ("id"),

        CONSTRAINT "CHK_guest_pricing_policies_maximum_child_age"
          CHECK ("maximum_child_age" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_guest_pricing_policies_property_id"
      ON "guest_pricing_policies" ("property_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "guest_pricing_policies"
      ADD CONSTRAINT "FK_guest_pricing_policies_property_id"
      FOREIGN KEY ("property_id")
      REFERENCES "properties"("id")
      ON DELETE RESTRICT
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "child_age_bands" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "guest_pricing_policy_id" uuid NOT NULL,
        "label" character varying(80) NOT NULL,
        "min_age" integer NOT NULL,
        "max_age" integer NOT NULL,
        "pricing_mode" "public"."child_age_bands_pricing_mode_enum" NOT NULL,
        "fixed_amount" numeric(12,2),
        "percentage" numeric(5,2),
        "display_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_child_age_bands_id"
          PRIMARY KEY ("id"),

        CONSTRAINT "CHK_child_age_bands_min_age"
          CHECK ("min_age" >= 0),

        CONSTRAINT "CHK_child_age_bands_age_range"
          CHECK ("max_age" >= "min_age"),

        CONSTRAINT "CHK_child_age_bands_fixed_amount"
          CHECK (
            "pricing_mode" <> 'FIXED_PER_NIGHT'
            OR "fixed_amount" IS NOT NULL
          ),

        CONSTRAINT "CHK_child_age_bands_percentage"
          CHECK (
            "pricing_mode" <> 'PERCENT_OF_ROOM_RATE'
            OR "percentage" IS NOT NULL
          ),

        CONSTRAINT "CHK_child_age_bands_percentage_range"
          CHECK (
            "percentage" IS NULL
            OR ("percentage" >= 0 AND "percentage" <= 100)
          ),

        CONSTRAINT "CHK_child_age_bands_fixed_amount_non_negative"
          CHECK (
            "fixed_amount" IS NULL
            OR "fixed_amount" >= 0
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_child_age_bands_policy_id"
      ON "child_age_bands" ("guest_pricing_policy_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_child_age_bands_policy_age_range"
      ON "child_age_bands" (
        "guest_pricing_policy_id",
        "min_age",
        "max_age"
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "child_age_bands"
      ADD CONSTRAINT "FK_child_age_bands_guest_pricing_policy_id"
      FOREIGN KEY ("guest_pricing_policy_id")
      REFERENCES "guest_pricing_policies"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "child_age_bands"
      DROP CONSTRAINT "FK_child_age_bands_guest_pricing_policy_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."UQ_child_age_bands_policy_age_range"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_child_age_bands_policy_id"
    `);

    await queryRunner.query(`
      DROP TABLE "child_age_bands"
    `);

    await queryRunner.query(`
      ALTER TABLE "guest_pricing_policies"
      DROP CONSTRAINT "FK_guest_pricing_policies_property_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."UQ_guest_pricing_policies_property_id"
    `);

    await queryRunner.query(`
      DROP TABLE "guest_pricing_policies"
    `);

    await queryRunner.query(`
      DROP TYPE "public"."child_age_bands_pricing_mode_enum"
    `);
  }
}
