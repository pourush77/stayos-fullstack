import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupBookingDepositPolicyToProperties1786776660000
  implements MigrationInterface
{
  name = 'AddGroupBookingDepositPolicyToProperties1786776660000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."properties_group_booking_deposit_policy_type_enum" AS ENUM('NONE', 'PERCENTAGE', 'FIXED_AMOUNT')`,
    );
    await queryRunner.query(`
      ALTER TABLE "properties"
      ADD "group_booking_deposit_policy_type" "public"."properties_group_booking_deposit_policy_type_enum" NOT NULL DEFAULT 'NONE'
    `);
    await queryRunner.query(`
      ALTER TABLE "properties"
      ADD "group_booking_deposit_policy_value" numeric(12,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "properties"
      ADD CONSTRAINT "CHK_properties_group_booking_deposit_policy_value"
      CHECK (
        "group_booking_deposit_policy_value" >= 0
        AND (
          "group_booking_deposit_policy_type" != 'PERCENTAGE'
          OR "group_booking_deposit_policy_value" <= 100
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "properties" DROP CONSTRAINT "CHK_properties_group_booking_deposit_policy_value"`,
    );
    await queryRunner.query(
      `ALTER TABLE "properties" DROP COLUMN "group_booking_deposit_policy_value"`,
    );
    await queryRunner.query(
      `ALTER TABLE "properties" DROP COLUMN "group_booking_deposit_policy_type"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."properties_group_booking_deposit_policy_type_enum"`,
    );
  }
}
