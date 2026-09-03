import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1C-d2: external booking identity on reservations. Adds nullable
 * source_provider (normalized varchar), external_reservation_id and
 * external_confirmation_id. Enforces idempotency/dedup with a PARTIAL unique
 * index scoped to (property_id, source_provider, external_reservation_id) only
 * where external_reservation_id IS NOT NULL — never global uniqueness, so the
 * same channel reservation id may recur across different providers/properties.
 * Additive and backward compatible (all columns nullable, no backfill).
 */
export class AddReservationExternalIdentity1786777680000 implements MigrationInterface {
  name = 'AddReservationExternalIdentity1786777680000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "source_provider" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "external_reservation_id" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "external_confirmation_id" character varying(128)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reservations_external_identity"
       ON "reservations" ("property_id", "source_provider", "external_reservation_id")
       WHERE "external_reservation_id" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_reservations_external_identity"`);
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN IF EXISTS "external_confirmation_id"`);
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN IF EXISTS "external_reservation_id"`);
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN IF EXISTS "source_provider"`);
  }
}
