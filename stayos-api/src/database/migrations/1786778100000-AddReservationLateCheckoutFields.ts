import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReservationLateCheckoutFields1786778100000 implements MigrationInterface {
  name = 'AddReservationLateCheckoutFields1786778100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "late_checkout_approved_until" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "late_checkout_approved_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "late_checkout_approved_by" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "late_checkout_notes" text`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN IF EXISTS "late_checkout_notes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN IF EXISTS "late_checkout_approved_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN IF EXISTS "late_checkout_approved_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN IF EXISTS "late_checkout_approved_until"`,
    );
  }
}
