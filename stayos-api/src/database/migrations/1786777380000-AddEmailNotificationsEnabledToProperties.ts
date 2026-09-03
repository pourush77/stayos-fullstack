import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailNotificationsEnabledToProperties1786777380000 implements MigrationInterface {
  name = 'AddEmailNotificationsEnabledToProperties1786777380000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "properties"
      ADD COLUMN "email_notifications_enabled" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "properties"
      DROP COLUMN "email_notifications_enabled"
    `);
  }
}
