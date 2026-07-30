import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuestPreferenceFields1784420000000 implements MigrationInterface {
  name = 'AddGuestPreferenceFields1784420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "guests"
      ADD COLUMN IF NOT EXISTS "room_preference" character varying(160),
      ADD COLUMN IF NOT EXISTS "bed_preference" character varying(64),
      ADD COLUMN IF NOT EXISTS "smoking_preference" character varying(64),
      ADD COLUMN IF NOT EXISTS "floor_preference" character varying(160),
      ADD COLUMN IF NOT EXISTS "dietary_notes" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "guests"
      DROP COLUMN IF EXISTS "dietary_notes",
      DROP COLUMN IF EXISTS "floor_preference",
      DROP COLUMN IF EXISTS "smoking_preference",
      DROP COLUMN IF EXISTS "bed_preference",
      DROP COLUMN IF EXISTS "room_preference"
    `);
  }
}
