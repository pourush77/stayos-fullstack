import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePropertyBillingConfig1786776900000 implements MigrationInterface {
  name = 'CreatePropertyBillingConfig1786776900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "property_billing_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "invoice_prefix" character varying(16) NOT NULL DEFAULT '',
        "next_invoice_number" integer NOT NULL DEFAULT 1,
        "reset_sequence_yearly" boolean NOT NULL DEFAULT true,
        "financial_year_start_month" integer NOT NULL DEFAULT 4,
        "default_hsn_sac" character varying(16),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_property_billing_configs_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_property_billing_configs_next_number" CHECK ("next_invoice_number" >= 1),
        CONSTRAINT "CHK_property_billing_configs_fy_month" CHECK (
          "financial_year_start_month" >= 1 AND "financial_year_start_month" <= 12
        )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_property_billing_configs_property_id"
      ON "property_billing_configs" ("property_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "property_billing_configs"
      ADD CONSTRAINT "FK_property_billing_configs_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "property_billing_configs" DROP CONSTRAINT "FK_property_billing_configs_property_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_property_billing_configs_property_id"`);
    await queryRunner.query(`DROP TABLE "property_billing_configs"`);
  }
}
