import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroupStaysAndMasterFolios1784765600000 implements MigrationInterface {
  name = 'CreateGroupStaysAndMasterFolios1784765600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "group_stays" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "group_booking_id" uuid NOT NULL,
        "checked_in_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'IN_HOUSE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_stays_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_group_stays_group_booking_id" UNIQUE ("group_booking_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "group_master_folios" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "group_booking_id" uuid NOT NULL,
        "group_stay_id" uuid NOT NULL,
        "folio_number" character varying(32) NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'OPEN',
        "currency" character varying(3) NOT NULL DEFAULT 'INR',
        "estimated_total" numeric(12,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_master_folios_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_group_master_folios_group_booking_id" UNIQUE ("group_booking_id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "group_stays" ADD CONSTRAINT "FK_group_stays_group_booking_id" FOREIGN KEY ("group_booking_id") REFERENCES "group_bookings"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "group_master_folios" ADD CONSTRAINT "FK_group_master_folios_group_booking_id" FOREIGN KEY ("group_booking_id") REFERENCES "group_bookings"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "group_master_folios" ADD CONSTRAINT "FK_group_master_folios_group_stay_id" FOREIGN KEY ("group_stay_id") REFERENCES "group_stays"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "group_master_folios" DROP CONSTRAINT "FK_group_master_folios_group_stay_id"`);
    await queryRunner.query(`ALTER TABLE "group_master_folios" DROP CONSTRAINT "FK_group_master_folios_group_booking_id"`);
    await queryRunner.query(`ALTER TABLE "group_stays" DROP CONSTRAINT "FK_group_stays_group_booking_id"`);
    await queryRunner.query(`DROP TABLE "group_master_folios"`);
    await queryRunner.query(`DROP TABLE "group_stays"`);
  }
}
