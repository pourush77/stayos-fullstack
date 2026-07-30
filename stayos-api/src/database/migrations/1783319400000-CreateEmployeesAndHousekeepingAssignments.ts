import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployeesAndHousekeepingAssignments1783319400000 implements MigrationInterface {
  name = 'CreateEmployeesAndHousekeepingAssignments1783319400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."employees_department_enum" AS ENUM('HOUSEKEEPING', 'MAINTENANCE', 'FRONT_DESK', 'ACCOUNTS', 'RESTAURANT', 'KITCHEN', 'LAUNDRY', 'SECURITY', 'SPA', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."employees_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "employees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "property_id" uuid NOT NULL, "employee_code" character varying(32) NOT NULL, "first_name" character varying(120) NOT NULL, "last_name" character varying(120) NOT NULL DEFAULT '', "display_name" character varying(240) NOT NULL, "department" "public"."employees_department_enum" NOT NULL, "designation" character varying(120) NOT NULL DEFAULT '', "phone" character varying(32), "status" "public"."employees_status_enum" NOT NULL DEFAULT 'ACTIVE', "photo_url" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_employees_property_employee_code" UNIQUE ("property_id", "employee_code"), CONSTRAINT "PK_employees" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_employees_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "rooms" ADD "assigned_employee_id" uuid`);
    await queryRunner.query(`ALTER TABLE "rooms" ADD "started_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "rooms" ADD "completed_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "rooms" ADD "inspected_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `ALTER TABLE "rooms" ADD "completed_on_behalf" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "rooms" ADD "completed_by_employee_id" uuid`);
    await queryRunner.query(`ALTER TABLE "rooms" ADD "completed_by_user_id" uuid`);
    await queryRunner.query(`ALTER TABLE "rooms" ADD "inspected_by_user_id" uuid`);
    await queryRunner.query(`ALTER TABLE "rooms" ADD "checklist" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE "rooms" ADD "rework_reason" text`);
    await queryRunner.query(
      `ALTER TABLE "rooms" ADD CONSTRAINT "FK_rooms_assigned_employee" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "FK_rooms_assigned_employee"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "rework_reason"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "checklist"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "inspected_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "completed_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "completed_by_employee_id"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "completed_on_behalf"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "inspected_at"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "completed_at"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "started_at"`);
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "assigned_employee_id"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_employees_property"`);
    await queryRunner.query(`DROP TABLE "employees"`);
    await queryRunner.query(`DROP TYPE "public"."employees_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."employees_department_enum"`);
  }
}
