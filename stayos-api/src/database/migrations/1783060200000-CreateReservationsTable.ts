import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReservationsTable1783060200000 implements MigrationInterface {
  name = 'CreateReservationsTable1783060200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."reservations_source_enum" AS ENUM('DIRECT', 'WALK_IN', 'OTA', 'CORPORATE', 'WEBSITE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reservations_status_enum" AS ENUM('CONFIRMED', 'PENDING', 'CANCELLED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reservations_payment_status_enum" AS ENUM('PAID', 'PAYMENT_DUE', 'PARTIALLY_PAID')`,
    );
    await queryRunner.query(`
      CREATE TABLE "reservations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "guest_id" uuid NOT NULL,
        "reservation_code" character varying(32) NOT NULL,
        "arrival_date" date NOT NULL,
        "departure_date" date NOT NULL,
        "adults" integer NOT NULL,
        "children" integer NOT NULL DEFAULT 0,
        "room_type_id" uuid NOT NULL,
        "room_id" uuid,
        "source" "public"."reservations_source_enum" NOT NULL DEFAULT 'DIRECT',
        "status" "public"."reservations_status_enum" NOT NULL DEFAULT 'CONFIRMED',
        "payment_status" "public"."reservations_payment_status_enum" NOT NULL DEFAULT 'PAYMENT_DUE',
        "notes" text,
        "special_requests" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reservations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reservations_property_code" UNIQUE ("property_id", "reservation_code"),
        CONSTRAINT "CHK_reservations_guest_counts" CHECK ("adults" >= 1 AND "children" >= 0),
        CONSTRAINT "CHK_reservations_date_range" CHECK ("departure_date" > "arrival_date")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_property_id" ON "reservations" ("property_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_guest_id" ON "reservations" ("guest_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_room_type_id" ON "reservations" ("room_type_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_room_id" ON "reservations" ("room_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_arrival_date" ON "reservations" ("arrival_date")`,
    );
    await queryRunner.query(`
      ALTER TABLE "reservations"
      ADD CONSTRAINT "FK_reservations_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "reservations"
      ADD CONSTRAINT "FK_reservations_guest_id"
      FOREIGN KEY ("guest_id") REFERENCES "guests"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "reservations"
      ADD CONSTRAINT "FK_reservations_room_type_id"
      FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "reservations"
      ADD CONSTRAINT "FK_reservations_room_id"
      FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT "FK_reservations_room_id"`);
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT "FK_reservations_room_type_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT "FK_reservations_guest_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT "FK_reservations_property_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_reservations_arrival_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reservations_room_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reservations_room_type_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reservations_guest_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reservations_property_id"`);
    await queryRunner.query(`DROP TABLE "reservations"`);
    await queryRunner.query(`DROP TYPE "public"."reservations_payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reservations_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reservations_source_enum"`);
  }
}
