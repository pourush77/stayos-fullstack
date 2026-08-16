import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryReservedToReservations20260820090000 implements MigrationInterface {
  name = 'AddInventoryReservedToReservations20260820090000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN "inventory_reserved" boolean NOT NULL DEFAULT false`,
    );

    // Mark every currently inventory-consuming reservation that is FULLY
    // represented in the ledger (every stay-night has a room_type_inventory
    // row) as holding an entitlement. Reservations on oversold-skipped nights
    // (no row) stay false so their eventual cancel never phantom-releases.
    await queryRunner.query(`
      UPDATE "reservations" r
      SET "inventory_reserved" = true
      WHERE r.status IN ('PENDING','CONFIRMED','CHECKED_IN')
        AND NOT EXISTS (
          SELECT 1
          FROM generate_series(r.arrival_date::date, r.departure_date::date - INTERVAL '1 day', INTERVAL '1 day') AS g(night)
          WHERE NOT EXISTS (
            SELECT 1 FROM room_type_inventory i
            WHERE i.property_id = r.property_id
              AND i.room_type_id = r.room_type_id
              AND i.date = g.night
          )
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "inventory_reserved"`);
  }
}
