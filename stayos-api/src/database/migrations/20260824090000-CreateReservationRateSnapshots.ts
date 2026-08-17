import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sub-phase B: dedicated append-only reservation commercial snapshot history.
 * Adds reservation_rate_snapshots (immutable versioned rows, exactly one ACTIVE
 * per reservation) + reservations.rate_snapshot_version. Backfills every
 * reservation that already has a rate_snapshot into version 1 WITHOUT
 * recalculating historical commercial values. reservations.rate_snapshot /
 * rate_plan_id remain the backward-compatible mirror of the ACTIVE version.
 */
export class CreateReservationRateSnapshots20260824090000 implements MigrationInterface {
  name = 'CreateReservationRateSnapshots20260824090000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_rate_snapshot_status_enum') THEN
          CREATE TYPE "public"."reservation_rate_snapshot_status_enum" AS ENUM ('ACTIVE', 'SUPERSEDED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_rate_snapshot_trigger_enum') THEN
          CREATE TYPE "public"."reservation_rate_snapshot_trigger_enum" AS ENUM
            ('INITIAL','RATE_PLAN_CHANGE','DATE_CHANGE','ROOM_TYPE_CHANGE','OCCUPANCY_CHANGE','STAY_EXTENSION','AMENDMENT');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reservation_rate_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reservation_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "status" "public"."reservation_rate_snapshot_status_enum" NOT NULL,
        "trigger" "public"."reservation_rate_snapshot_trigger_enum" NOT NULL,
        "reason" text,
        "rate_plan_id" uuid,
        "commercial_input_hash" varchar(64) NOT NULL,
        "snapshot" jsonb NOT NULL,
        "effective_from" timestamptz NOT NULL,
        "superseded_at" timestamptz,
        "superseded_by_version" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reservation_rate_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rrs_reservation" FOREIGN KEY ("reservation_id")
          REFERENCES "reservations"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_rrs_version_positive" CHECK ("version" >= 1)
      );
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_rrs_reservation_version" ON "reservation_rate_snapshots" ("reservation_id", "version");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rrs_reservation_id" ON "reservation_rate_snapshots" ("reservation_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rrs_property_id" ON "reservation_rate_snapshots" ("property_id");`,
    );
    // Exactly one ACTIVE commercial version per reservation.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_rrs_one_active_per_reservation" ON "reservation_rate_snapshots" ("reservation_id") WHERE "status" = 'ACTIVE';`,
    );

    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "rate_snapshot_version" integer;`,
    );

    // Backfill: freeze each existing snapshot as version 1 (no recompute).
    await queryRunner.query(`
      INSERT INTO "reservation_rate_snapshots"
        ("reservation_id", "property_id", "version", "status", "trigger", "reason",
         "rate_plan_id", "commercial_input_hash", "snapshot", "effective_from")
      SELECT
        r."id", r."property_id", 1, 'ACTIVE', 'INITIAL', NULL, r."rate_plan_id",
        md5(
          'v1|' || coalesce(r."rate_plan_id"::text, 'NONE') || '|' ||
          r."room_type_id"::text || '|' || r."arrival_date"::text || '|' ||
          r."departure_date"::text || '|' || r."adults"::text || '|' ||
          coalesce((
            SELECT string_agg(value, ',' ORDER BY value::int)
            FROM jsonb_array_elements_text(r."child_ages")
          ), '')
        ),
        r."rate_snapshot", coalesce(r."created_at", now())
      FROM "reservations" r
      WHERE r."rate_snapshot" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "reservation_rate_snapshots" s WHERE s."reservation_id" = r."id"
        );
    `);

    await queryRunner.query(
      `UPDATE "reservations" SET "rate_snapshot_version" = 1 WHERE "rate_snapshot" IS NOT NULL AND "rate_snapshot_version" IS NULL;`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN IF EXISTS "rate_snapshot_version";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reservation_rate_snapshots";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."reservation_rate_snapshot_trigger_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."reservation_rate_snapshot_status_enum";`);
  }
}
