import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuestServiceFields20260808163000 implements MigrationInterface {
  name = 'AddGuestServiceFields20260808163000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."guest_requests_request_type_enum" AS ENUM (
        'EXTRA_TOWELS',
        'EXTRA_PILLOW',
        'WATER_BOTTLES',
        'LAUNDRY_PICKUP',
        'WAKE_UP_CALL',
        'AIRPORT_PICKUP',
        'AIRPORT_DROP',
        'TAXI',
        'LUGGAGE_ASSISTANCE',
        'BABY_COT',
        'EXTRA_BED',
        'HAIR_DRYER',
        'IRON_BOARD',
        'ROOM_CLEANING',
        'AC_ISSUE',
        'TV_ISSUE',
        'WIFI_ISSUE',
        'SPECIAL_DECORATION',
        'FLOWERS',
        'CAKE',
        'OTHER'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "guest_requests"
      ADD COLUMN "request_type"
      "public"."guest_requests_request_type_enum"
      NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "guest_requests"
      ADD COLUMN "details" jsonb NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_guest_requests_request_type"
      ON "guest_requests" ("request_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_guest_requests_request_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "guest_requests"
      DROP COLUMN IF EXISTS "details"
    `);

    await queryRunner.query(`
      ALTER TABLE "guest_requests"
      DROP COLUMN IF EXISTS "request_type"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."guest_requests_request_type_enum"
    `);
  }
}
