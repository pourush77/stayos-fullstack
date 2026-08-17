import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRatePlanAndRateSnapshotToReservations20260822090000 implements MigrationInterface {
  name = 'AddRatePlanAndRateSnapshotToReservations20260822090000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reservations" ADD COLUMN "rate_plan_id" uuid`);
    await queryRunner.query(`ALTER TABLE "reservations" ADD COLUMN "rate_snapshot" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD CONSTRAINT "FK_reservations_rate_plan" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_rate_plan_id" ON "reservations" ("rate_plan_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_reservations_rate_plan_id"`);
    await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT "FK_reservations_rate_plan"`);
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "rate_snapshot"`);
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "rate_plan_id"`);
  }
}
