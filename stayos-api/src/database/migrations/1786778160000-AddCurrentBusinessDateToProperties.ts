import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrentBusinessDateToProperties1786778160000 implements MigrationInterface {
  name = 'AddCurrentBusinessDateToProperties1786778160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "properties"
      ADD COLUMN IF NOT EXISTS "current_business_date" date
    `);

    await queryRunner.query(`
      UPDATE "properties"
      SET "current_business_date" = CASE
        WHEN "timezone" IS NOT NULL AND (CURRENT_TIMESTAMP AT TIME ZONE "timezone")::time < COALESCE("business_day_cut_off_time", '00:00:00'::time)
        THEN ((CURRENT_TIMESTAMP AT TIME ZONE "timezone") - INTERVAL '1 day')::date
        WHEN "timezone" IS NOT NULL
        THEN (CURRENT_TIMESTAMP AT TIME ZONE "timezone")::date
        ELSE CURRENT_DATE
      END
      WHERE "current_business_date" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "properties"
      ALTER COLUMN "current_business_date" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "properties"
      DROP COLUMN IF EXISTS "current_business_date"
    `);
  }
}
