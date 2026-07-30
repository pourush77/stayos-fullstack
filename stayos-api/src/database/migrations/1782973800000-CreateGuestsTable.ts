import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuestsTable1782973800000 implements MigrationInterface {
  name = 'CreateGuestsTable1782973800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."guests_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(`
      CREATE TABLE "guests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "first_name" character varying(120) NOT NULL,
        "last_name" character varying(120),
        "display_name" character varying(240) NOT NULL,
        "phone" character varying(32) NOT NULL,
        "alternate_phone" character varying(32),
        "email" character varying(254),
        "gender" character varying(32),
        "date_of_birth" date,
        "anniversary_date" date,
        "nationality" character varying(120),
        "preferred_language" character varying(64),
        "company_name" character varying(160),
        "gst_number" character varying(15),
        "vip_status" boolean NOT NULL DEFAULT false,
        "blacklist_status" boolean NOT NULL DEFAULT false,
        "notes" text,
        "status" "public"."guests_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guests_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_guests_property_phone" UNIQUE ("property_id", "phone")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_guests_property_id" ON "guests" ("property_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_guests_display_name" ON "guests" ("display_name")`);
    await queryRunner.query(`CREATE INDEX "IDX_guests_phone" ON "guests" ("phone")`);
    await queryRunner.query(`CREATE INDEX "IDX_guests_email" ON "guests" ("email")`);
    await queryRunner.query(`
      ALTER TABLE "guests"
      ADD CONSTRAINT "FK_guests_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "guests" DROP CONSTRAINT "FK_guests_property_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guests_email"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guests_phone"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guests_display_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guests_property_id"`);
    await queryRunner.query(`DROP TABLE "guests"`);
    await queryRunner.query(`DROP TYPE "public"."guests_status_enum"`);
  }
}
