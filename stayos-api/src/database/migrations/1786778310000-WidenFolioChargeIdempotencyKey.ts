import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nightly accommodation charge idempotency keys include property, reservation,
 * snapshot, version, and service-night identity, which exceeds the original
 * 120-character charge key limit.
 */
export class WidenFolioChargeIdempotencyKey1786778310000 implements MigrationInterface {
  name = 'WidenFolioChargeIdempotencyKey1786778310000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "folio_charges" ALTER COLUMN "idempotency_key" TYPE varchar(240)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "folio_charges" ALTER COLUMN "idempotency_key" TYPE varchar(120)`,
    );
  }
}
