import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReservationChildAges1786776480000 implements MigrationInterface {
  name = 'AddReservationChildAges1786776480000';

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
