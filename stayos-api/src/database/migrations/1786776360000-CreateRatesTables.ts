import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRatesTables1786776360000 implements MigrationInterface {
  name = 'CreateRatesTables1786776360000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."rate_plans_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );

    await queryRunner.query(`
      CREATE TABLE "rate_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "code" character varying(32) NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text,
        "is_default" boolean NOT NULL DEFAULT false,
        "status" "public"."rate_plans_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rate_plans_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_rate_plans_property_code" ON "rate_plans" ("property_id", "code")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_rate_plans_property_default" ON "rate_plans" ("property_id") WHERE "is_default" = true`,
    );
    await queryRunner.query(`
      ALTER TABLE "rate_plans"
      ADD CONSTRAINT "FK_rate_plans_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "room_type_daily_rates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "rate_plan_id" uuid NOT NULL,
        "stay_date" date NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_type_daily_rates_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_room_type_daily_rates_amount" CHECK ("amount" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_room_type_daily_rates_room_type_rate_plan_stay_date" ON "room_type_daily_rates" ("room_type_id", "rate_plan_id", "stay_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_room_type_daily_rates_property_id" ON "room_type_daily_rates" ("property_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "room_type_daily_rates"
      ADD CONSTRAINT "FK_room_type_daily_rates_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "room_type_daily_rates"
      ADD CONSTRAINT "FK_room_type_daily_rates_room_type_id"
      FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "room_type_daily_rates"
      ADD CONSTRAINT "FK_room_type_daily_rates_rate_plan_id"
      FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_type_daily_rates" DROP CONSTRAINT "FK_room_type_daily_rates_rate_plan_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_type_daily_rates" DROP CONSTRAINT "FK_room_type_daily_rates_room_type_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_type_daily_rates" DROP CONSTRAINT "FK_room_type_daily_rates_property_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_room_type_daily_rates_property_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_room_type_daily_rates_room_type_rate_plan_stay_date"`,
    );
    await queryRunner.query(`DROP TABLE "room_type_daily_rates"`);

    await queryRunner.query(`ALTER TABLE "rate_plans" DROP CONSTRAINT "FK_rate_plans_property_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_rate_plans_property_default"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_rate_plans_property_code"`);
    await queryRunner.query(`DROP TABLE "rate_plans"`);

    await queryRunner.query(`DROP TYPE "public"."rate_plans_status_enum"`);
  }
}
