import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaintenanceRoomUnavailableFlag1786437000000 implements MigrationInterface {
  name = 'AddMaintenanceRoomUnavailableFlag1786437000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('maintenance_tickets');

    if (!table) {
      throw new Error('maintenance_tickets table does not exist');
    }

    if (table.findColumnByName('makes_room_unavailable')) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "maintenance_tickets" ADD "makes_room_unavailable" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('maintenance_tickets');

    if (!table || !table.findColumnByName('makes_room_unavailable')) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "maintenance_tickets" DROP COLUMN "makes_room_unavailable"`,
    );
  }
}
