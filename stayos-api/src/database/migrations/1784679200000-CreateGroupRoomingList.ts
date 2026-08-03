import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroupRoomingList1784679200000 implements MigrationInterface {
  name = 'CreateGroupRoomingList1784679200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "group_booking_rooming_list" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "group_booking_id" uuid NOT NULL,
        "guest_name" character varying(160) NOT NULL,
        "adults" integer NOT NULL DEFAULT 1,
        "children" integer NOT NULL DEFAULT 0,
        "phone" character varying(32),
        "notes" text,
        "assigned_room_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_booking_rooming_list_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "group_booking_room_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "group_booking_id" uuid NOT NULL,
        "room_id" uuid NOT NULL,
        "room_type_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_booking_room_assignments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_group_booking_room_assignments_group_room" UNIQUE ("group_booking_id", "room_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_group_booking_rooming_list_group_id" ON "group_booking_rooming_list" ("group_booking_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_group_booking_room_assignments_room_id" ON "group_booking_room_assignments" ("room_id")`);
    await queryRunner.query(`ALTER TABLE "group_booking_rooming_list" ADD CONSTRAINT "FK_group_booking_rooming_list_group_id" FOREIGN KEY ("group_booking_id") REFERENCES "group_bookings"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "group_booking_rooming_list" ADD CONSTRAINT "FK_group_booking_rooming_list_assigned_room_id" FOREIGN KEY ("assigned_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "group_booking_room_assignments" ADD CONSTRAINT "FK_group_booking_room_assignments_group_id" FOREIGN KEY ("group_booking_id") REFERENCES "group_bookings"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "group_booking_room_assignments" ADD CONSTRAINT "FK_group_booking_room_assignments_room_id" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "group_booking_room_assignments" DROP CONSTRAINT "FK_group_booking_room_assignments_room_id"`);
    await queryRunner.query(`ALTER TABLE "group_booking_room_assignments" DROP CONSTRAINT "FK_group_booking_room_assignments_group_id"`);
    await queryRunner.query(`ALTER TABLE "group_booking_rooming_list" DROP CONSTRAINT "FK_group_booking_rooming_list_assigned_room_id"`);
    await queryRunner.query(`ALTER TABLE "group_booking_rooming_list" DROP CONSTRAINT "FK_group_booking_rooming_list_group_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_group_booking_room_assignments_room_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_group_booking_rooming_list_group_id"`);
    await queryRunner.query(`DROP TABLE "group_booking_room_assignments"`);
    await queryRunner.query(`DROP TABLE "group_booking_rooming_list"`);
  }
}
