import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationDeliveries20260822150000 implements MigrationInterface {
  name = 'CreateNotificationDeliveries20260822150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."notification_deliveries_channel_enum" AS ENUM('EMAIL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_deliveries_notification_type_enum" AS ENUM('BOOKING_CONFIRMATION', 'CHECKOUT_INVOICE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_deliveries_status_enum" AS ENUM('PENDING', 'SENT', 'FAILED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "notification_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "channel" "public"."notification_deliveries_channel_enum" NOT NULL,
        "notification_type" "public"."notification_deliveries_notification_type_enum" NOT NULL,
        "entity_type" character varying(32) NOT NULL,
        "entity_id" uuid NOT NULL,
        "recipient" character varying(320) NOT NULL,
        "status" "public"."notification_deliveries_status_enum" NOT NULL DEFAULT 'PENDING',
        "provider" character varying(64),
        "provider_message_id" character varying(255),
        "dedupe_key" character varying(255) NOT NULL,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "next_attempt_at" TIMESTAMP WITH TIME ZONE,
        "last_error" text,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_deliveries_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_notification_deliveries_dedupe_key" ON "notification_deliveries" ("dedupe_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_deliveries_property_id" ON "notification_deliveries" ("property_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_deliveries_status_next_attempt" ON "notification_deliveries" ("status", "next_attempt_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_deliveries_property_entity" ON "notification_deliveries" ("property_id", "entity_type", "entity_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "notification_deliveries"
      ADD CONSTRAINT "FK_notification_deliveries_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_deliveries" DROP CONSTRAINT "FK_notification_deliveries_property_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_notification_deliveries_property_entity"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_deliveries_status_next_attempt"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_notification_deliveries_property_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_notification_deliveries_dedupe_key"`);
    await queryRunner.query(`DROP TABLE "notification_deliveries"`);
    await queryRunner.query(`DROP TYPE "public"."notification_deliveries_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notification_deliveries_notification_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notification_deliveries_channel_enum"`);
  }
}
