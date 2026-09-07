import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cross-snapshot nightly service-night uniqueness (V2.3E2). Enforces at most one
 * LIVE nightly accommodation ROOM charge per (folio_id, service_date), so a rate
 * snapshot version change can never create a second posted accommodation charge
 * for the same night. The partial predicate deliberately excludes:
 *  - NULL service_date rows (upfront aggregate full-stay / legacy / manual ROOM),
 *  - non-ROOM charge types,
 *  - REVERSED / REVERSAL rows (status <> POSTED),
 * so historical corrections and non-nightly charges remain fully representable.
 * Additive: creation fails loudly if pre-existing live duplicates exist rather
 * than silently mutating financial history.
 */
export class AddNightlyServiceDateUniqueIndex1786778320000 implements MigrationInterface {
  name = 'AddNightlyServiceDateUniqueIndex1786778320000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_folio_charges_nightly_service_date" ` +
        `ON "folio_charges" ("folio_id", "service_date") ` +
        `WHERE "service_date" IS NOT NULL AND "type" = 'ROOM' AND "status" = 'POSTED'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_folio_charges_nightly_service_date"`);
  }
}
