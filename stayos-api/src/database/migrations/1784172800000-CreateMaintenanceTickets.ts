import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMaintenanceTickets1784172800000 implements MigrationInterface {
  name = 'CreateMaintenanceTickets1784172800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."maintenance_tickets_category_enum" AS ENUM('PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'OTHER')`);
    await queryRunner.query(`CREATE TYPE "public"."maintenance_tickets_priority_enum" AS ENUM('LOW', 'NORMAL', 'HIGH')`);
    await queryRunner.query(`CREATE TYPE "public"."maintenance_tickets_status_enum" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')`);
    await queryRunner.query(`
      CREATE TABLE "maintenance_tickets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "room_id" uuid,
        "reported_by_user_id" uuid NOT NULL,
        "assigned_to_user_id" uuid,
        "title" character varying(120) NOT NULL,
        "description" text,
        "category" "public"."maintenance_tickets_category_enum" NOT NULL,
        "priority" "public"."maintenance_tickets_priority_enum" NOT NULL DEFAULT 'NORMAL',
        "status" "public"."maintenance_tickets_status_enum" NOT NULL DEFAULT 'OPEN',
        "reported_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "resolution_note" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_maintenance_tickets_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_maintenance_tickets_property_status" ON "maintenance_tickets" ("property_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_maintenance_tickets_room_id" ON "maintenance_tickets" ("room_id")`);
    await queryRunner.query(`ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "FK_maintenance_tickets_property_id" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "FK_maintenance_tickets_room_id" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "FK_maintenance_tickets_reported_by_user_id" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "FK_maintenance_tickets_assigned_to_user_id" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "maintenance_tickets" DROP CONSTRAINT "FK_maintenance_tickets_assigned_to_user_id"`);
    await queryRunner.query(`ALTER TABLE "maintenance_tickets" DROP CONSTRAINT "FK_maintenance_tickets_reported_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "maintenance_tickets" DROP CONSTRAINT "FK_maintenance_tickets_room_id"`);
    await queryRunner.query(`ALTER TABLE "maintenance_tickets" DROP CONSTRAINT "FK_maintenance_tickets_property_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_maintenance_tickets_room_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_maintenance_tickets_property_status"`);
    await queryRunner.query(`DROP TABLE "maintenance_tickets"`);
    await queryRunner.query(`DROP TYPE "public"."maintenance_tickets_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."maintenance_tickets_priority_enum"`);
    await queryRunner.query(`DROP TYPE "public"."maintenance_tickets_category_enum"`);
  }
}
