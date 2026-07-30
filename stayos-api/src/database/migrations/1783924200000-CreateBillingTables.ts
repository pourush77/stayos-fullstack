import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBillingTables1783924200000 implements MigrationInterface {
  name = 'CreateBillingTables1783924200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."folios_status_enum" AS ENUM('OPEN', 'SETTLED', 'VOID')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."folio_charges_type_enum" AS ENUM('ROOM', 'FOOD_AND_BEVERAGE', 'MINIBAR', 'LAUNDRY', 'SPA', 'TAX', 'DISCOUNT', 'MISC')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."folio_payments_method_enum" AS ENUM('CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'WALLET', 'OTHER')`,
    );

    await queryRunner.query(`
      CREATE TABLE "folios" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "reservation_id" uuid NOT NULL,
        "guest_id" uuid NOT NULL,
        "folio_number" character varying(32) NOT NULL,
        "status" "public"."folios_status_enum" NOT NULL DEFAULT 'OPEN',
        "currency" character varying(3) NOT NULL DEFAULT 'INR',
        "settled_at" TIMESTAMP WITH TIME ZONE,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_folios_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_folios_reservation_id" UNIQUE ("reservation_id"),
        CONSTRAINT "UQ_folios_property_number" UNIQUE ("property_id", "folio_number")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_folios_property_id" ON "folios" ("property_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_folios_guest_id" ON "folios" ("guest_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_folios_status" ON "folios" ("status")`);
    await queryRunner.query(`
      ALTER TABLE "folios"
      ADD CONSTRAINT "FK_folios_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "folios"
      ADD CONSTRAINT "FK_folios_reservation_id"
      FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "folios"
      ADD CONSTRAINT "FK_folios_guest_id"
      FOREIGN KEY ("guest_id") REFERENCES "guests"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "folio_charges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "folio_id" uuid NOT NULL,
        "type" "public"."folio_charges_type_enum" NOT NULL,
        "description" character varying(160) NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "unit_amount" numeric(12,2) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "tax_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "charged_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_by_user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_folio_charges_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_folio_charges_folio_id" ON "folio_charges" ("folio_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_folio_charges_charged_at" ON "folio_charges" ("charged_at")`);
    await queryRunner.query(`
      ALTER TABLE "folio_charges"
      ADD CONSTRAINT "FK_folio_charges_folio_id"
      FOREIGN KEY ("folio_id") REFERENCES "folios"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "folio_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "folio_id" uuid NOT NULL,
        "method" "public"."folio_payments_method_enum" NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "reference" character varying(120),
        "notes" text,
        "received_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "received_by_user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_folio_payments_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_folio_payments_folio_id" ON "folio_payments" ("folio_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_folio_payments_received_at" ON "folio_payments" ("received_at")`);
    await queryRunner.query(`
      ALTER TABLE "folio_payments"
      ADD CONSTRAINT "FK_folio_payments_folio_id"
      FOREIGN KEY ("folio_id") REFERENCES "folios"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "folio_payments" DROP CONSTRAINT "FK_folio_payments_folio_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_folio_payments_received_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_folio_payments_folio_id"`);
    await queryRunner.query(`DROP TABLE "folio_payments"`);

    await queryRunner.query(`ALTER TABLE "folio_charges" DROP CONSTRAINT "FK_folio_charges_folio_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_folio_charges_charged_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_folio_charges_folio_id"`);
    await queryRunner.query(`DROP TABLE "folio_charges"`);

    await queryRunner.query(`ALTER TABLE "folios" DROP CONSTRAINT "FK_folios_guest_id"`);
    await queryRunner.query(`ALTER TABLE "folios" DROP CONSTRAINT "FK_folios_reservation_id"`);
    await queryRunner.query(`ALTER TABLE "folios" DROP CONSTRAINT "FK_folios_property_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_folios_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_folios_guest_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_folios_property_id"`);
    await queryRunner.query(`DROP TABLE "folios"`);

    await queryRunner.query(`DROP TYPE "public"."folio_payments_method_enum"`);
    await queryRunner.query(`DROP TYPE "public"."folio_charges_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."folios_status_enum"`);
  }
}
