import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkflowEventTables1783146600000 implements MigrationInterface {
  name = 'CreateWorkflowEventTables1783146600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "actor_id" uuid,
        "entity_type" character varying(80) NOT NULL,
        "entity_id" uuid NOT NULL,
        "action" character varying(120) NOT NULL,
        "previous_state" jsonb,
        "next_state" jsonb,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_property_id" ON "audit_events" ("property_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_entity" ON "audit_events" ("entity_type", "entity_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "audit_events"
      ADD CONSTRAINT "FK_audit_events_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "activity_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "type" character varying(120) NOT NULL,
        "title" character varying(160) NOT NULL,
        "description" text NOT NULL,
        "entity_type" character varying(80) NOT NULL,
        "entity_id" uuid NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_events_property_id" ON "activity_events" ("property_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_events_entity" ON "activity_events" ("entity_type", "entity_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "activity_events"
      ADD CONSTRAINT "FK_activity_events_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_events" DROP CONSTRAINT "FK_activity_events_property_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_activity_events_entity"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_activity_events_property_id"`);
    await queryRunner.query(`DROP TABLE "activity_events"`);

    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "FK_audit_events_property_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_events_entity"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_events_property_id"`);
    await queryRunner.query(`DROP TABLE "audit_events"`);
  }
}
