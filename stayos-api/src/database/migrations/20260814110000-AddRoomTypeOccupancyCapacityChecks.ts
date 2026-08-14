import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomTypeOccupancyCapacityChecks20260814110000 implements MigrationInterface {
  name = 'AddRoomTypeOccupancyCapacityChecks20260814110000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "room_types"
      ADD CONSTRAINT "CHK_room_types_max_adults_capacity"
      CHECK ("max_adults" <= "max_occupancy")
    `);

    await queryRunner.query(`
      ALTER TABLE "room_types"
      ADD CONSTRAINT "CHK_room_types_max_children_capacity"
      CHECK ("max_children" <= "max_occupancy")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "room_types"
      DROP CONSTRAINT "CHK_room_types_max_children_capacity"
    `);

    await queryRunner.query(`
      ALTER TABLE "room_types"
      DROP CONSTRAINT "CHK_room_types_max_adults_capacity"
    `);
  }
}
