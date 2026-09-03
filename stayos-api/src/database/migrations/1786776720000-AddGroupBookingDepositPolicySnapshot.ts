import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupBookingDepositPolicySnapshot1786776720000
  implements MigrationInterface
{
  name = 'AddGroupBookingDepositPolicySnapshot1786776720000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."group_bookings_deposit_policy_type_enum" AS ENUM('NONE', 'PERCENTAGE', 'FIXED_AMOUNT')`,
    );
    await queryRunner.query(`
      ALTER TABLE "group_bookings"
      ADD "deposit_policy_type" "public"."group_bookings_deposit_policy_type_enum" NOT NULL DEFAULT 'NONE'
    `);
    await queryRunner.query(`
      ALTER TABLE "group_bookings"
      ADD "deposit_policy_value" numeric(12,2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "group_bookings" DROP COLUMN "deposit_policy_value"`);
    await queryRunner.query(`ALTER TABLE "group_bookings" DROP COLUMN "deposit_policy_type"`);
    await queryRunner.query(`DROP TYPE "public"."group_bookings_deposit_policy_type_enum"`);
  }
}
