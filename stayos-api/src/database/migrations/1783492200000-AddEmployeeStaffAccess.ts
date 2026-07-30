import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeeStaffAccess1783492200000 implements MigrationInterface {
  name = 'AddEmployeeStaffAccess1783492200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "staff_access_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "employees" ADD "staff_access_token" text`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_employees_staff_access_token" ON "employees" ("staff_access_token") WHERE "staff_access_token" IS NOT NULL`,
    );
    await queryRunner.query(
      `
        UPDATE "employees"
        SET
          "staff_access_enabled" = true,
          "staff_access_token" = replace(uuid_generate_v4()::text, '-', '')
        WHERE "department" = 'HOUSEKEEPING'
          AND "status" = 'ACTIVE'
          AND "staff_access_token" IS NULL
      `,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_employees_staff_access_token"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "staff_access_token"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "staff_access_enabled"`);
  }
}
