import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reservation-code concurrency hardening: replaces the racy count()+1 code
 * generation with an atomic per-property counter. One row per property; the
 * create transaction does an upsert-increment (ON CONFLICT DO UPDATE
 * ... RETURNING) so concurrent creates serialize on the counter row and each
 * gets a distinct value, and a rolled-back create undoes its increment.
 *
 * Backfill seeds each property's last_value from the MAX trailing-numeric
 * suffix of its existing reservation codes (HS{YYMMDD}-{NNNNN}) so newly
 * allocated codes never collide with historical ones (count-based backfill
 * would be unsafe after deletions). Idempotent / backward compatible.
 */
export class CreateReservationCodeCounters1786777740000 implements MigrationInterface {
  name = 'CreateReservationCodeCounters1786777740000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reservation_code_counters" (
        "property_id" uuid PRIMARY KEY,
        "last_value" bigint NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_reservation_code_counters_property"
          FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_reservation_code_counters_nonneg" CHECK ("last_value" >= 0)
      )
    `);

    await queryRunner.query(`
      INSERT INTO "reservation_code_counters" ("property_id", "last_value")
      SELECT r."property_id",
             COALESCE(MAX((substring(r."reservation_code" from '[0-9]+$'))::bigint), 0)
      FROM "reservations" r
      GROUP BY r."property_id"
      ON CONFLICT ("property_id") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reservation_code_counters"`);
  }
}
