import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNightAuditRunsTable1786778220000 implements MigrationInterface {
  name = 'CreateNightAuditRunsTable1786778220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."night_audit_runs_status_enum" AS ENUM('OPEN', 'COMPLETED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "night_audit_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "business_date" date NOT NULL,
        "status" "public"."night_audit_runs_status_enum" NOT NULL DEFAULT 'OPEN',
        "started_by_user_id" uuid NOT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "completed_by_user_id" uuid,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "summary" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_night_audit_runs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_night_audit_runs_property_business_date" UNIQUE ("property_id", "business_date"),
        CONSTRAINT "FK_night_audit_runs_property_id" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_night_audit_runs_started_by_user_id" FOREIGN KEY ("started_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_night_audit_runs_completed_by_user_id" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_night_audit_runs_property_open"
      ON "night_audit_runs" ("property_id")
      WHERE "status" = 'OPEN'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_night_audit_runs_property_open"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "night_audit_runs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."night_audit_runs_status_enum"`);
  }
}
