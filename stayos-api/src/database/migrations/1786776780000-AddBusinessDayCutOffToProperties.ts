import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessDayCutOffToProperties1786776780000 implements MigrationInterface {
  name = 'AddBusinessDayCutOffToProperties1786776780000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "properties"
      ADD COLUMN "business_day_cut_off_time" time without time zone NOT NULL DEFAULT '00:00:00'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "properties"
      DROP COLUMN "business_day_cut_off_time"
    `);
  }
}
