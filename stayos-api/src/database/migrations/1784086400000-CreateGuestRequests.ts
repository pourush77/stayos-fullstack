import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuestRequests1784086400000 implements MigrationInterface {
  name = 'CreateGuestRequests1784086400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."guest_requests_status_enum" AS ENUM('REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')`);
    await queryRunner.query(`CREATE TYPE "public"."guest_requests_priority_enum" AS ENUM('NORMAL', 'HIGH', 'VIP')`);
    await queryRunner.query(`CREATE TYPE "public"."guest_requests_department_enum" AS ENUM('HOUSEKEEPING', 'MAINTENANCE', 'LAUNDRY', 'RECEPTION', 'CONCIERGE', 'F_AND_B')`);
    await queryRunner.query(`
      CREATE TABLE "guest_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "reservation_id" uuid,
        "guest_id" uuid,
        "room_id" uuid,
        "assigned_employee_id" uuid,
        "title" character varying(120) NOT NULL,
        "description" text,
        "status" "public"."guest_requests_status_enum" NOT NULL DEFAULT 'REQUESTED',
        "priority" "public"."guest_requests_priority_enum" NOT NULL DEFAULT 'NORMAL',
        "department" "public"."guest_requests_department_enum" NOT NULL,
        "due_at" TIMESTAMP WITH TIME ZONE,
        "accepted_at" TIMESTAMP WITH TIME ZONE,
        "started_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guest_requests_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_guest_requests_property_status" ON "guest_requests" ("property_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_guest_requests_property_department" ON "guest_requests" ("property_id", "department")`);
    await queryRunner.query(`CREATE INDEX "IDX_guest_requests_reservation_id" ON "guest_requests" ("reservation_id")`);
    await queryRunner.query(`ALTER TABLE "guest_requests" ADD CONSTRAINT "FK_guest_requests_property_id" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "guest_requests" ADD CONSTRAINT "FK_guest_requests_reservation_id" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "guest_requests" ADD CONSTRAINT "FK_guest_requests_guest_id" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "guest_requests" ADD CONSTRAINT "FK_guest_requests_room_id" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "guest_requests" ADD CONSTRAINT "FK_guest_requests_assigned_employee_id" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`
      CREATE TABLE "guest_request_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "request_id" uuid NOT NULL,
        "actor_id" uuid,
        "body" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guest_request_notes_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_guest_request_notes_request_id" ON "guest_request_notes" ("request_id")`);
    await queryRunner.query(`ALTER TABLE "guest_request_notes" ADD CONSTRAINT "FK_guest_request_notes_property_id" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "guest_request_notes" ADD CONSTRAINT "FK_guest_request_notes_request_id" FOREIGN KEY ("request_id") REFERENCES "guest_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "guest_request_notes" ADD CONSTRAINT "FK_guest_request_notes_actor_id" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "guest_request_notes" DROP CONSTRAINT "FK_guest_request_notes_actor_id"`);
    await queryRunner.query(`ALTER TABLE "guest_request_notes" DROP CONSTRAINT "FK_guest_request_notes_request_id"`);
    await queryRunner.query(`ALTER TABLE "guest_request_notes" DROP CONSTRAINT "FK_guest_request_notes_property_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guest_request_notes_request_id"`);
    await queryRunner.query(`DROP TABLE "guest_request_notes"`);
    await queryRunner.query(`ALTER TABLE "guest_requests" DROP CONSTRAINT "FK_guest_requests_assigned_employee_id"`);
    await queryRunner.query(`ALTER TABLE "guest_requests" DROP CONSTRAINT "FK_guest_requests_room_id"`);
    await queryRunner.query(`ALTER TABLE "guest_requests" DROP CONSTRAINT "FK_guest_requests_guest_id"`);
    await queryRunner.query(`ALTER TABLE "guest_requests" DROP CONSTRAINT "FK_guest_requests_reservation_id"`);
    await queryRunner.query(`ALTER TABLE "guest_requests" DROP CONSTRAINT "FK_guest_requests_property_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guest_requests_reservation_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guest_requests_property_department"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guest_requests_property_status"`);
    await queryRunner.query(`DROP TABLE "guest_requests"`);
    await queryRunner.query(`DROP TYPE "public"."guest_requests_department_enum"`);
    await queryRunner.query(`DROP TYPE "public"."guest_requests_priority_enum"`);
    await queryRunner.query(`DROP TYPE "public"."guest_requests_status_enum"`);
  }
}
