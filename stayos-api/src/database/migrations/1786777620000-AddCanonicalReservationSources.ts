import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1C-d1: additive canonicalization of the reservation source vocabulary.
 * Adds FRONT_DESK, PHONE, CHANNEL, OTHER to reservations_source_enum. Legacy
 * values (DIRECT, OTA, WALK_IN, WEBSITE, CORPORATE) are preserved untouched —
 * no backfill, no rewrite (historical origin is ambiguous). New writes prefer
 * the canonical vocabulary; the create default moves to FRONT_DESK in code.
 * Backward compatible. PostgreSQL cannot drop enum values, so down() is a no-op.
 */
export class AddCanonicalReservationSources1786777620000 implements MigrationInterface {
  name = 'AddCanonicalReservationSources1786777620000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of ['FRONT_DESK', 'PHONE', 'CHANNEL', 'OTHER']) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumlabel = '${value}'
              AND enumtypid = 'public.reservations_source_enum'::regtype
          ) THEN
            ALTER TYPE "public"."reservations_source_enum" ADD VALUE '${value}';
          END IF;
        END
        $$;
      `);
    }
  }

  async down(): Promise<void> {
    // PostgreSQL cannot safely remove an enum value without recreating the type.
  }
}
