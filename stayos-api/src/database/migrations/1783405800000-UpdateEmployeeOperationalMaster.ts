import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateEmployeeOperationalMaster1783405800000 implements MigrationInterface {
  name = 'UpdateEmployeeOperationalMaster1783405800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."employees_department_enum" ADD VALUE IF NOT EXISTS 'ACCOUNTS'`,
    );
    await queryRunner.query(`ALTER TABLE "employees" ALTER COLUMN "last_name" SET DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "employees" ALTER COLUMN "designation" SET DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "employees" ALTER COLUMN "phone" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" ALTER COLUMN "phone" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "employees" ALTER COLUMN "designation" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "employees" ALTER COLUMN "last_name" DROP DEFAULT`);
  }
}
