import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroupBookings1784592800000 implements MigrationInterface {
  name = 'CreateGroupBookings1784592800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."group_bookings_source_enum" AS ENUM('WALK_IN', 'PHONE', 'AGENT', 'CORPORATE', 'CHANNEL_MANAGER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."group_bookings_status_enum" AS ENUM('ON_HOLD', 'CONFIRMED', 'RELEASED', 'CANCELLED', 'CHECKED_IN')`,
    );
    await queryRunner.query(`
      CREATE TABLE "group_bookings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "group_code" character varying(32) NOT NULL,
        "group_name" character varying(160) NOT NULL,
        "lead_name" character varying(160) NOT NULL,
        "lead_phone" character varying(32) NOT NULL,
        "lead_email" character varying(160),
        "arrival_date" date NOT NULL,
        "departure_date" date NOT NULL,
        "adults" integer NOT NULL,
        "children" integer NOT NULL DEFAULT 0,
        "source" "public"."group_bookings_source_enum" NOT NULL DEFAULT 'PHONE',
        "status" "public"."group_bookings_status_enum" NOT NULL DEFAULT 'ON_HOLD',
        "release_at" TIMESTAMP WITH TIME ZONE,
        "deposit_required" numeric(12,2) NOT NULL DEFAULT 0,
        "estimated_total" numeric(12,2) NOT NULL DEFAULT 0,
        "external_channel_id" character varying(120),
        "sync_status" character varying(40) NOT NULL DEFAULT 'PMS_ONLY',
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_bookings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_group_bookings_property_code" UNIQUE ("property_id", "group_code"),
        CONSTRAINT "CHK_group_bookings_guest_counts" CHECK ("adults" >= 1 AND "children" >= 0),
        CONSTRAINT "CHK_group_bookings_date_range" CHECK ("departure_date" > "arrival_date"),
        CONSTRAINT "CHK_group_bookings_deposit" CHECK ("deposit_required" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "group_booking_room_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "group_booking_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "rooms" integer NOT NULL,
        "adults_per_room" integer NOT NULL DEFAULT 1,
        "children_per_room" integer NOT NULL DEFAULT 0,
        "base_rate" numeric(12,2) NOT NULL DEFAULT 0,
        "estimated_total" numeric(12,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_booking_room_blocks_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_group_booking_room_blocks_rooms" CHECK ("rooms" > 0),
        CONSTRAINT "CHK_group_booking_room_blocks_rates" CHECK ("base_rate" >= 0 AND "estimated_total" >= 0)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_group_bookings_property_status" ON "group_bookings" ("property_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_group_bookings_arrival_date" ON "group_bookings" ("arrival_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_group_booking_room_blocks_group_id" ON "group_booking_room_blocks" ("group_booking_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_group_booking_room_blocks_room_type_id" ON "group_booking_room_blocks" ("room_type_id")`);
    await queryRunner.query(`
      ALTER TABLE "group_bookings"
      ADD CONSTRAINT "FK_group_bookings_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "group_booking_room_blocks"
      ADD CONSTRAINT "FK_group_booking_room_blocks_group_booking_id"
      FOREIGN KEY ("group_booking_id") REFERENCES "group_bookings"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "group_booking_room_blocks"
      ADD CONSTRAINT "FK_group_booking_room_blocks_room_type_id"
      FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "group_booking_room_blocks" DROP CONSTRAINT "FK_group_booking_room_blocks_room_type_id"`);
    await queryRunner.query(`ALTER TABLE "group_booking_room_blocks" DROP CONSTRAINT "FK_group_booking_room_blocks_group_booking_id"`);
    await queryRunner.query(`ALTER TABLE "group_bookings" DROP CONSTRAINT "FK_group_bookings_property_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_group_booking_room_blocks_room_type_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_group_booking_room_blocks_group_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_group_bookings_arrival_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_group_bookings_property_status"`);
    await queryRunner.query(`DROP TABLE "group_booking_room_blocks"`);
    await queryRunner.query(`DROP TABLE "group_bookings"`);
    await queryRunner.query(`DROP TYPE "public"."group_bookings_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."group_bookings_source_enum"`);
  }
}
