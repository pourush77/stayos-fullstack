import { MigrationInterface, QueryRunner } from 'typeorm';

export class RatePlanCommercialModel1786777200000 implements MigrationInterface {
  name = 'RatePlanCommercialModel1786777200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."rate_plans_meal_plan_enum" AS ENUM('ROOM_ONLY','BREAKFAST','HALF_BOARD','FULL_BOARD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" ADD COLUMN "meal_plan" "public"."rate_plans_meal_plan_enum" NOT NULL DEFAULT 'ROOM_ONLY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plans" ADD COLUMN "refundable" boolean NOT NULL DEFAULT true`,
    );

    await queryRunner.query(`
      CREATE TABLE "rate_plan_room_types" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "rate_plan_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "base_occupancy" integer NOT NULL DEFAULT 2,
        "base_rate" numeric(12,2) NOT NULL,
        "extra_adult_charge" numeric(12,2) NOT NULL DEFAULT 0,
        "extra_child_charge" numeric(12,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rate_plan_room_types_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_rate_plan_room_types_base_occupancy" CHECK ("base_occupancy" >= 1),
        CONSTRAINT "CHK_rate_plan_room_types_base_rate" CHECK ("base_rate" >= 0),
        CONSTRAINT "CHK_rate_plan_room_types_extra_adult" CHECK ("extra_adult_charge" >= 0),
        CONSTRAINT "CHK_rate_plan_room_types_extra_child" CHECK ("extra_child_charge" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_rate_plan_room_types_plan_room_type" ON "rate_plan_room_types" ("rate_plan_id","room_type_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rate_plan_room_types_property_id" ON "rate_plan_room_types" ("property_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rate_plan_room_types_room_type_id" ON "rate_plan_room_types" ("room_type_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plan_room_types" ADD CONSTRAINT "FK_rate_plan_room_types_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plan_room_types" ADD CONSTRAINT "FK_rate_plan_room_types_rate_plan" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_plan_room_types" ADD CONSTRAINT "FK_rate_plan_room_types_room_type" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "rate_plan_room_types"`);
    await queryRunner.query(`ALTER TABLE "rate_plans" DROP COLUMN "refundable"`);
    await queryRunner.query(`ALTER TABLE "rate_plans" DROP COLUMN "meal_plan"`);
    await queryRunner.query(`DROP TYPE "public"."rate_plans_meal_plan_enum"`);
  }
}
