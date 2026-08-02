import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepairMobileCaptureSchema1784506400000 implements MigrationInterface {
  name = 'RepairMobileCaptureSchema1784506400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('mobile_capture_sessions')) {
      await this.repairMobileCaptureSessions(queryRunner);
    }
    if (await queryRunner.hasTable('guest_documents')) {
      await this.repairGuestDocuments(queryRunner);
    }
  }

  public async down(): Promise<void> {
    // Compatibility migration only. Do not restore the legacy capture schema.
  }

  private async repairMobileCaptureSessions(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('mobile_capture_sessions', 'token'))) {
      await queryRunner.query(`ALTER TABLE "mobile_capture_sessions" ADD "token" character varying(64)`);
      await queryRunner.query(
        `UPDATE "mobile_capture_sessions" SET "token" = LEFT(COALESCE("token_hash", replace("id"::text, '-', '')), 64)`,
      );
      await queryRunner.query(`ALTER TABLE "mobile_capture_sessions" ALTER COLUMN "token" SET NOT NULL`);
    }

    if (!(await queryRunner.hasColumn('mobile_capture_sessions', 'updated_at'))) {
      await queryRunner.query(
        `ALTER TABLE "mobile_capture_sessions" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
      );
    }

    if (await queryRunner.hasColumn('mobile_capture_sessions', 'guest_id')) {
      await queryRunner.query(`ALTER TABLE "mobile_capture_sessions" ALTER COLUMN "guest_id" DROP NOT NULL`);
    }
    if (await queryRunner.hasColumn('mobile_capture_sessions', 'token_hash')) {
      await queryRunner.query(`ALTER TABLE "mobile_capture_sessions" ALTER COLUMN "token_hash" DROP NOT NULL`);
    }
    if (await queryRunner.hasColumn('mobile_capture_sessions', 'allowed_document_types')) {
      await queryRunner.query(
        `ALTER TABLE "mobile_capture_sessions" ALTER COLUMN "allowed_document_types" DROP NOT NULL`,
      );
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_mobile_capture_sessions_token" ON "mobile_capture_sessions" ("token")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_capture_sessions_reservation_id" ON "mobile_capture_sessions" ("reservation_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_mobile_capture_sessions_active_reservation" ON "mobile_capture_sessions" ("reservation_id") WHERE "status" = 'ACTIVE'`,
    );
  }

  private async repairGuestDocuments(queryRunner: QueryRunner): Promise<void> {
    const legacyNullableColumns = [
      'type',
      'storage_key',
      'uploaded_via',
      'captured_at',
    ];

    for (const column of legacyNullableColumns) {
      if (await queryRunner.hasColumn('guest_documents', column)) {
        await queryRunner.query(`ALTER TABLE "guest_documents" ALTER COLUMN "${column}" DROP NOT NULL`);
      }
    }

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_guest_documents_property_id" ON "guest_documents" ("property_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_guest_documents_reservation_id" ON "guest_documents" ("reservation_id")`,
    );
  }
}
