import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMobileCaptureDocuments1784000000000 implements MigrationInterface {
  name = 'CreateMobileCaptureDocuments1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasMobileCaptureSessions = await queryRunner.hasTable('mobile_capture_sessions');
    const hasGuestDocuments = await queryRunner.hasTable('guest_documents');

    if (hasMobileCaptureSessions && hasGuestDocuments) {
      if (!(await queryRunner.hasColumn('guest_documents', 'side'))) {
        await queryRunner.query(`ALTER TABLE "guest_documents" ADD "side" character varying(16)`);
        await queryRunner.query(`UPDATE "guest_documents" SET "side" = COALESCE("type"::text, 'ID_FRONT')`);
        await queryRunner.query(`ALTER TABLE "guest_documents" ALTER COLUMN "side" SET NOT NULL`);
      }
      if (!(await queryRunner.hasColumn('guest_documents', 'document_kind'))) {
        await queryRunner.query(`ALTER TABLE "guest_documents" ADD "document_kind" character varying(48)`);
        await queryRunner.query(`UPDATE "guest_documents" SET "document_kind" = COALESCE("side", "type"::text, 'ID_FRONT')`);
        await queryRunner.query(`ALTER TABLE "guest_documents" ALTER COLUMN "document_kind" SET NOT NULL`);
      }
      if (!(await queryRunner.hasColumn('guest_documents', 'storage_path'))) {
        await queryRunner.query(`ALTER TABLE "guest_documents" ADD "storage_path" text`);
        await queryRunner.query(`UPDATE "guest_documents" SET "storage_path" = COALESCE("storage_key", '')`);
        await queryRunner.query(`ALTER TABLE "guest_documents" ALTER COLUMN "storage_path" SET NOT NULL`);
      }
      if (!(await queryRunner.hasColumn('guest_documents', 'updated_at'))) {
        await queryRunner.query(`ALTER TABLE "guest_documents" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
      }
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "mobile_capture_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "reservation_id" uuid NOT NULL,
        "token" character varying(64) NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'ACTIVE',
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mobile_capture_sessions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_mobile_capture_sessions_token" ON "mobile_capture_sessions" ("token")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mobile_capture_sessions_reservation_id" ON "mobile_capture_sessions" ("reservation_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_mobile_capture_sessions_active_reservation" ON "mobile_capture_sessions" ("reservation_id") WHERE "status" = 'ACTIVE'`,
    );
    await queryRunner.query(`
      ALTER TABLE "mobile_capture_sessions"
      ADD CONSTRAINT "FK_mobile_capture_sessions_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "mobile_capture_sessions"
      ADD CONSTRAINT "FK_mobile_capture_sessions_reservation_id"
      FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "guest_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "guest_id" uuid NOT NULL,
        "reservation_id" uuid NOT NULL,
        "document_kind" character varying(48) NOT NULL,
        "side" character varying(16) NOT NULL,
        "original_filename" character varying(160) NOT NULL,
        "mime_type" character varying(80) NOT NULL,
        "size_bytes" integer NOT NULL,
        "storage_path" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guest_documents_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_guest_documents_property_id" ON "guest_documents" ("property_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guest_documents_reservation_id" ON "guest_documents" ("reservation_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_guest_documents_reservation_side" ON "guest_documents" ("reservation_id", "side")`,
    );
    await queryRunner.query(`
      ALTER TABLE "guest_documents"
      ADD CONSTRAINT "FK_guest_documents_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "guest_documents"
      ADD CONSTRAINT "FK_guest_documents_guest_id"
      FOREIGN KEY ("guest_id") REFERENCES "guests"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "guest_documents"
      ADD CONSTRAINT "FK_guest_documents_reservation_id"
      FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guest_documents" DROP CONSTRAINT "FK_guest_documents_reservation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_documents" DROP CONSTRAINT "FK_guest_documents_guest_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_documents" DROP CONSTRAINT "FK_guest_documents_property_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_guest_documents_reservation_side"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guest_documents_reservation_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guest_documents_property_id"`);
    await queryRunner.query(`DROP TABLE "guest_documents"`);
    await queryRunner.query(
      `ALTER TABLE "mobile_capture_sessions" DROP CONSTRAINT "FK_mobile_capture_sessions_reservation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobile_capture_sessions" DROP CONSTRAINT "FK_mobile_capture_sessions_property_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_mobile_capture_sessions_active_reservation"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mobile_capture_sessions_reservation_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mobile_capture_sessions_token"`);
    await queryRunner.query(`DROP TABLE "mobile_capture_sessions"`);
  }
}
