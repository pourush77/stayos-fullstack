import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheckedOutGroupBookingStatus1785800000000 implements MigrationInterface {
  name = 'AddCheckedOutGroupBookingStatus1785800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = 'CHECKED_OUT'
            AND enumtypid = 'public.group_bookings_status_enum'::regtype
        ) THEN
          ALTER TYPE "public"."group_bookings_status_enum" ADD VALUE 'CHECKED_OUT';
        END IF;
      END
      $$;
    `);
  }

  async down(): Promise<void> {
    // PostgreSQL cannot safely remove an enum value without recreating the type.
  }
}
