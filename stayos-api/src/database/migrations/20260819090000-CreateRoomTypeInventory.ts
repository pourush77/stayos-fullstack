import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoomTypeInventory20260819090000 implements MigrationInterface {
  name = 'CreateRoomTypeInventory20260819090000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "room_type_inventory" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "date" date NOT NULL,
        "capacity" integer NOT NULL,
        "sold" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_room_type_inventory_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_room_type_inventory_capacity" CHECK ("capacity" >= 0),
        CONSTRAINT "CHK_room_type_inventory_sold_non_negative" CHECK ("sold" >= 0),
        CONSTRAINT "CHK_room_type_inventory_sold_within_capacity" CHECK ("sold" <= "capacity")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_room_type_inventory_pool_date"
      ON "room_type_inventory" ("property_id", "room_type_id", "date")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_room_type_inventory_property_id" ON "room_type_inventory" ("property_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_room_type_inventory_room_type_id" ON "room_type_inventory" ("room_type_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "room_type_inventory"
      ADD CONSTRAINT "FK_room_type_inventory_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "room_type_inventory"
      ADD CONSTRAINT "FK_room_type_inventory_room_type_id"
      FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // Backfill safety: we NEVER clamp sold, inflate capacity, or silently
    // correct data. Nights where consuming reservations exceed structural
    // capacity are reported here (migration log) and deliberately left
    // un-backfilled so the reconciliation service surfaces them as
    // OVERSELL + MISSING_ROW conflicts for operators to resolve.
    await queryRunner.query(`
      DO $$
      DECLARE
        conflict record;
        conflict_count int := 0;
      BEGIN
        FOR conflict IN
          WITH consuming AS (
            SELECT property_id, room_type_id, arrival_date, departure_date
            FROM reservations
            WHERE status IN ('PENDING','CONFIRMED','CHECKED_IN')
          ),
          nights AS (
            SELECT property_id, room_type_id,
                   generate_series(arrival_date::date, departure_date::date - INTERVAL '1 day', INTERVAL '1 day')::date AS date
            FROM consuming
          ),
          expected AS (
            SELECT property_id, room_type_id, date, COUNT(*)::int AS sold
            FROM nights GROUP BY property_id, room_type_id, date
          ),
          capacity AS (
            SELECT property_id, room_type_id, COUNT(*)::int AS capacity
            FROM rooms WHERE status = 'ACTIVE'
            GROUP BY property_id, room_type_id
          )
          SELECT e.property_id, e.room_type_id, e.date, e.sold, COALESCE(c.capacity, 0) AS capacity
          FROM expected e
          LEFT JOIN capacity c ON c.property_id = e.property_id AND c.room_type_id = e.room_type_id
          WHERE e.sold > COALESCE(c.capacity, 0)
        LOOP
          conflict_count := conflict_count + 1;
          RAISE WARNING 'room_type_inventory backfill oversell (left for reconciliation): property=% room_type=% date=% sold=% capacity=%',
            conflict.property_id, conflict.room_type_id, conflict.date, conflict.sold, conflict.capacity;
        END LOOP;

        IF conflict_count > 0 THEN
          RAISE WARNING 'room_type_inventory backfill: % (property,roomType,date) rows exceed structural capacity and were NOT backfilled. Run InventoryReconciliationService.reconcile() to review OVERSELL/MISSING_ROW conflicts.', conflict_count;
        END IF;
      END $$;
    `);

    // Deterministic backfill: one row per stay-night of every currently
    // inventory-consuming reservation, EXCEPT nights that would violate the
    // sold <= capacity invariant (those are reported above and reconciled
    // later — never clamped). capacity = active physical-room count.
    await queryRunner.query(`
      WITH consuming AS (
        SELECT property_id, room_type_id, arrival_date, departure_date
        FROM reservations
        WHERE status IN ('PENDING','CONFIRMED','CHECKED_IN')
      ),
      nights AS (
        SELECT property_id, room_type_id,
               generate_series(arrival_date::date, departure_date::date - INTERVAL '1 day', INTERVAL '1 day')::date AS date
        FROM consuming
      ),
      expected AS (
        SELECT property_id, room_type_id, date, COUNT(*)::int AS sold
        FROM nights GROUP BY property_id, room_type_id, date
      ),
      capacity AS (
        SELECT property_id, room_type_id, COUNT(*)::int AS capacity
        FROM rooms WHERE status = 'ACTIVE'
        GROUP BY property_id, room_type_id
      )
      INSERT INTO room_type_inventory (property_id, room_type_id, date, capacity, sold)
      SELECT e.property_id, e.room_type_id, e.date, COALESCE(c.capacity, 0), e.sold
      FROM expected e
      LEFT JOIN capacity c ON c.property_id = e.property_id AND c.room_type_id = e.room_type_id
      WHERE e.sold <= COALESCE(c.capacity, 0)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room_type_inventory" DROP CONSTRAINT "FK_room_type_inventory_room_type_id"`);
    await queryRunner.query(`ALTER TABLE "room_type_inventory" DROP CONSTRAINT "FK_room_type_inventory_property_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_room_type_inventory_room_type_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_room_type_inventory_property_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_room_type_inventory_pool_date"`);
    await queryRunner.query(`DROP TABLE "room_type_inventory"`);
  }
}
