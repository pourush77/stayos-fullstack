import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReservationPolicyTaxSnapshots1786776960000 implements MigrationInterface {
  name = 'AddReservationPolicyTaxSnapshots1786776960000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reservations" ADD COLUMN "policy_snapshot" jsonb`);
    await queryRunner.query(`ALTER TABLE "reservations" ADD COLUMN "tax_snapshot" jsonb`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "tax_snapshot"`);
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "policy_snapshot"`);
  }
}
