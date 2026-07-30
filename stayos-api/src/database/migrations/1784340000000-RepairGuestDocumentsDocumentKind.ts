import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepairGuestDocumentsDocumentKind1784340000000 implements MigrationInterface {
  name = 'RepairGuestDocumentsDocumentKind1784340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('guest_documents'))) {
      return;
    }

    const hasLegacyType = await queryRunner.hasColumn('guest_documents', 'type');
    const legacySideExpression = hasLegacyType ? `"type"::text` : `'ID_FRONT'`;

    if (!(await queryRunner.hasColumn('guest_documents', 'side'))) {
      await queryRunner.query(`ALTER TABLE "guest_documents" ADD "side" character varying(16)`);
      await queryRunner.query(`UPDATE "guest_documents" SET "side" = COALESCE(${legacySideExpression}, 'ID_FRONT')`);
      await queryRunner.query(`ALTER TABLE "guest_documents" ALTER COLUMN "side" SET NOT NULL`);
    }

    if (!(await queryRunner.hasColumn('guest_documents', 'document_kind'))) {
      await queryRunner.query(`ALTER TABLE "guest_documents" ADD "document_kind" character varying(48)`);
      await queryRunner.query(`UPDATE "guest_documents" SET "document_kind" = COALESCE("side", ${legacySideExpression}, 'ID_FRONT')`);
      await queryRunner.query(`ALTER TABLE "guest_documents" ALTER COLUMN "document_kind" SET NOT NULL`);
    }

    if (!(await queryRunner.hasColumn('guest_documents', 'storage_path'))) {
      const hasStorageKey = await queryRunner.hasColumn('guest_documents', 'storage_key');
      const storageExpression = hasStorageKey ? `"storage_key"` : `''`;
      await queryRunner.query(`ALTER TABLE "guest_documents" ADD "storage_path" text`);
      await queryRunner.query(`UPDATE "guest_documents" SET "storage_path" = COALESCE(${storageExpression}, '')`);
      await queryRunner.query(`ALTER TABLE "guest_documents" ALTER COLUMN "storage_path" SET NOT NULL`);
    }

    if (!(await queryRunner.hasColumn('guest_documents', 'updated_at'))) {
      await queryRunner.query(`ALTER TABLE "guest_documents" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('guest_documents')) &&
      (await queryRunner.hasColumn('guest_documents', 'document_kind'))
    ) {
      await queryRunner.query(`ALTER TABLE "guest_documents" DROP COLUMN "document_kind"`);
    }
  }
}
