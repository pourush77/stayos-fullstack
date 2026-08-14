import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReservationChildAges20260814103000 implements MigrationInterface {
  name = 'AddReservationChildAges20260814103000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reservations"
      ADD "child_ages" jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reservations"
      DROP COLUMN "child_ages"
    `);
  }
}
