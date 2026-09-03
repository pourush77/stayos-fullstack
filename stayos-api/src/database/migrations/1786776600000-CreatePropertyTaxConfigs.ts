import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePropertyTaxConfigs1786776600000 implements MigrationInterface {
  name = 'CreatePropertyTaxConfigs1786776600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "property_tax_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "name" character varying(80) NOT NULL DEFAULT 'GST',
        "percentage" numeric(5,2) NOT NULL DEFAULT 12.00,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_property_tax_configs_id"
          PRIMARY KEY ("id"),

        CONSTRAINT "CHK_property_tax_configs_percentage_range"
          CHECK ("percentage" >= 0 AND "percentage" <= 100),

        CONSTRAINT "CHK_property_tax_configs_active_name"
          CHECK ("is_active" = false OR length(trim("name")) > 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_property_tax_configs_property_id"
      ON "property_tax_configs" ("property_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "property_tax_configs"
      ADD CONSTRAINT "FK_property_tax_configs_property_id"
      FOREIGN KEY ("property_id")
      REFERENCES "properties"("id")
      ON DELETE RESTRICT
      ON UPDATE NO ACTION
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "property_tax_configs"
      DROP CONSTRAINT "FK_property_tax_configs_property_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."UQ_property_tax_configs_property_id"
    `);

    await queryRunner.query(`
      DROP TABLE "property_tax_configs"
    `);
  }
}
