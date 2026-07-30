import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePropertiesTable1782790200000 implements MigrationInterface {
  name = 'CreatePropertiesTable1782790200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."properties_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(`
      CREATE TABLE "properties" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(32) NOT NULL,
        "name" character varying(160) NOT NULL,
        "legal_name" character varying(200) NOT NULL,
        "gst_number" character varying(15) NOT NULL,
        "pan_number" character varying(10),
        "cin_number" character varying(32),
        "logo_url" character varying(512),
        "email" character varying(254) NOT NULL,
        "phone" character varying(32) NOT NULL,
        "website" character varying(255),
        "address_line_1" character varying(255) NOT NULL,
        "address_line_2" character varying(255),
        "city" character varying(120) NOT NULL,
        "state" character varying(120) NOT NULL,
        "state_code" character varying(2) NOT NULL,
        "country" character varying(120) NOT NULL,
        "postal_code" character varying(16) NOT NULL,
        "timezone" character varying(64) NOT NULL,
        "currency" character(3) NOT NULL,
        "check_in_time" time without time zone NOT NULL,
        "check_out_time" time without time zone NOT NULL,
        "total_floors" integer NOT NULL DEFAULT 0,
        "total_rooms" integer NOT NULL DEFAULT 0,
        "status" "public"."properties_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_properties_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_properties_code" UNIQUE ("code")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "properties"`);
    await queryRunner.query(`DROP TYPE "public"."properties_status_enum"`);
  }
}
