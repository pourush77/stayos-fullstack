import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foundation for future nightly accommodation posting.
 * Reservation owns the posting mode because it governs the stay's accommodation
 * pricing/posting lifecycle. Existing rows are explicitly backfilled to the
 * current legacy behavior before the column becomes NOT NULL.
 *
 * folio_charges.service_date is nullable and intentionally unbackfilled:
 * NULL means legacy full-stay/manual/non-nightly charge.
 */
export class AddAccommodationPostingModeAndServiceDate1786778300000
  implements MigrationInterface
{
  name = 'AddAccommodationPostingModeAndServiceDate1786778300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservations_accommodation_posting_mode_enum') THEN
          CREATE TYPE "public"."reservations_accommodation_posting_mode_enum" AS ENUM ('UPFRONT_FULL_STAY', 'NIGHTLY_V1');
        END IF;
      END $$;`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "accommodation_posting_mode" "public"."reservations_accommodation_posting_mode_enum"`,
    );
    await queryRunner.query(
      `UPDATE "reservations" SET "accommodation_posting_mode" = 'UPFRONT_FULL_STAY' WHERE "accommodation_posting_mode" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ALTER COLUMN "accommodation_posting_mode" SET DEFAULT 'UPFRONT_FULL_STAY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ALTER COLUMN "accommodation_posting_mode" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "folio_charges" ADD COLUMN IF NOT EXISTS "service_date" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "folio_charges" DROP COLUMN IF EXISTS "service_date"`);
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN IF EXISTS "accommodation_posting_mode"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."reservations_accommodation_posting_mode_enum"`,
    );
  }
}
