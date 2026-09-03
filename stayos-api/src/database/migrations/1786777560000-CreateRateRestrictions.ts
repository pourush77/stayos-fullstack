import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1C-c1: ARI sale restrictions. Additive only — no changes to existing
 * tables, no backfill. Existing reservations/inventory/pricing untouched.
 */
export class CreateRateRestrictions1786777560000 implements MigrationInterface {
  name = 'CreateRateRestrictions1786777560000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rate_restrictions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "rate_plan_id" uuid,
        "date" date NOT NULL,
        "stop_sell" boolean,
        "cta" boolean,
        "ctd" boolean,
        "min_stay" integer,
        "max_stay" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rate_restrictions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rate_restrictions_room_type" FOREIGN KEY ("room_type_id")
          REFERENCES "room_types"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rate_restrictions_rate_plan" FOREIGN KEY ("rate_plan_id")
          REFERENCES "rate_plans"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_rate_restrictions_min_stay" CHECK ("min_stay" IS NULL OR "min_stay" >= 1),
        CONSTRAINT "CHK_rate_restrictions_max_stay" CHECK ("max_stay" IS NULL OR "max_stay" >= 1),
        CONSTRAINT "CHK_rate_restrictions_los" CHECK ("min_stay" IS NULL OR "max_stay" IS NULL OR "max_stay" >= "min_stay")
      );
    `);

    // Exactly one roomType-level row and one row per rate plan per date.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_rate_restrictions_room_type_level"
       ON "rate_restrictions" ("property_id", "room_type_id", "date") WHERE "rate_plan_id" IS NULL;`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_rate_restrictions_rate_plan_level"
       ON "rate_restrictions" ("property_id", "room_type_id", "date", "rate_plan_id") WHERE "rate_plan_id" IS NOT NULL;`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rate_restrictions_lookup"
       ON "rate_restrictions" ("property_id", "room_type_id", "date");`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rate_restrictions";`);
  }
}
