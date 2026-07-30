import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHotelInventoryTables1782795600000 implements MigrationInterface {
  name = 'CreateHotelInventoryTables1782795600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."floors_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."room_types_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."rooms_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."rooms_operational_status_enum" AS ENUM('READY', 'OCCUPIED', 'NEEDS_CLEANING', 'INSPECTION', 'OUT_OF_SERVICE', 'OUT_OF_ORDER', 'MAINTENANCE')`,
    );

    await queryRunner.query(`
      CREATE TABLE "floors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "code" character varying(32) NOT NULL,
        "name" character varying(120) NOT NULL,
        "floor_number" integer NOT NULL,
        "display_order" integer NOT NULL DEFAULT 0,
        "description" text,
        "status" "public"."floors_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_floors_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_floors_property_code" UNIQUE ("property_id", "code"),
        CONSTRAINT "UQ_floors_property_floor_number" UNIQUE ("property_id", "floor_number")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_floors_property_id" ON "floors" ("property_id")`);

    await queryRunner.query(`
      CREATE TABLE "room_types" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "code" character varying(32) NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text,
        "base_occupancy" integer NOT NULL,
        "max_occupancy" integer NOT NULL,
        "max_adults" integer NOT NULL,
        "max_children" integer NOT NULL DEFAULT 0,
        "bed_type" character varying(80),
        "size_sq_ft" integer,
        "status" "public"."room_types_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_types_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_room_types_property_code" UNIQUE ("property_id", "code"),
        CONSTRAINT "CHK_room_types_base_occupancy" CHECK ("base_occupancy" >= 1),
        CONSTRAINT "CHK_room_types_max_occupancy" CHECK ("max_occupancy" >= "base_occupancy"),
        CONSTRAINT "CHK_room_types_max_adults" CHECK ("max_adults" >= 1),
        CONSTRAINT "CHK_room_types_max_children" CHECK ("max_children" >= 0),
        CONSTRAINT "CHK_room_types_size_sq_ft" CHECK ("size_sq_ft" IS NULL OR "size_sq_ft" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_room_types_property_id" ON "room_types" ("property_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "floor_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "room_number" character varying(32) NOT NULL,
        "display_name" character varying(120),
        "description" text,
        "status" "public"."rooms_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "operational_status" "public"."rooms_operational_status_enum" NOT NULL DEFAULT 'READY',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rooms_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_rooms_property_room_number" UNIQUE ("property_id", "room_number")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_rooms_property_id" ON "rooms" ("property_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_rooms_floor_id" ON "rooms" ("floor_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_rooms_room_type_id" ON "rooms" ("room_type_id")`);

    await queryRunner.query(`
      ALTER TABLE "floors"
      ADD CONSTRAINT "FK_floors_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "room_types"
      ADD CONSTRAINT "FK_room_types_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "rooms"
      ADD CONSTRAINT "FK_rooms_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "rooms"
      ADD CONSTRAINT "FK_rooms_floor_id"
      FOREIGN KEY ("floor_id") REFERENCES "floors"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "rooms"
      ADD CONSTRAINT "FK_rooms_room_type_id"
      FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "FK_rooms_room_type_id"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "FK_rooms_floor_id"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "FK_rooms_property_id"`);
    await queryRunner.query(`ALTER TABLE "room_types" DROP CONSTRAINT "FK_room_types_property_id"`);
    await queryRunner.query(`ALTER TABLE "floors" DROP CONSTRAINT "FK_floors_property_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_rooms_room_type_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_rooms_floor_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_rooms_property_id"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_room_types_property_id"`);
    await queryRunner.query(`DROP TABLE "room_types"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_floors_property_id"`);
    await queryRunner.query(`DROP TABLE "floors"`);
    await queryRunner.query(`DROP TYPE "public"."rooms_operational_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."rooms_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."room_types_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."floors_status_enum"`);
  }
}
