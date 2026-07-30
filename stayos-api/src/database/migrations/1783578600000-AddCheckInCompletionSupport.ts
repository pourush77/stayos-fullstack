import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheckInCompletionSupport1783578600000 implements MigrationInterface {
  name = 'AddCheckInCompletionSupport1783578600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "guests"
      ADD "address_line_1" character varying(240),
      ADD "address_line_2" character varying(240),
      ADD "city" character varying(120),
      ADD "state" character varying(120),
      ADD "country" character varying(120),
      ADD "postal_code" character varying(24),
      ADD "purpose_of_visit" character varying(160),
      ADD "arrival_from" character varying(160),
      ADD "next_destination" character varying(160)
    `);
    await queryRunner.query(
      `CREATE TYPE "public"."reservations_c_form_status_enum" AS ENUM('NOT_REQUIRED', 'PENDING', 'SUBMITTED')`,
    );
    await queryRunner.query(`
      ALTER TABLE "reservations"
      ADD "payment_reviewed" boolean NOT NULL DEFAULT false,
      ADD "payment_method" character varying(80),
      ADD "payment_review_notes" text,
      ADD "is_foreign_national" boolean NOT NULL DEFAULT false,
      ADD "passport_number_masked" character varying(64),
      ADD "passport_issue_place" character varying(120),
      ADD "passport_issue_date" date,
      ADD "passport_expiry_date" date,
      ADD "visa_number_masked" character varying(64),
      ADD "visa_type" character varying(80),
      ADD "visa_issue_date" date,
      ADD "visa_expiry_date" date,
      ADD "c_form_required" boolean NOT NULL DEFAULT false,
      ADD "c_form_status" "public"."reservations_c_form_status_enum" NOT NULL DEFAULT 'NOT_REQUIRED'
    `);
    await queryRunner.query(
      `CREATE TYPE "public"."guest_identity_documents_id_type_enum" AS ENUM('AADHAAR', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'PAN', 'OTHER')`,
    );
    await queryRunner.query(`
      CREATE TABLE "guest_identity_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "property_id" uuid NOT NULL,
        "guest_id" uuid NOT NULL,
        "reservation_id" uuid NOT NULL,
        "id_type" "public"."guest_identity_documents_id_type_enum" NOT NULL,
        "id_number_masked" character varying(64) NOT NULL,
        "document_front_url" text,
        "document_back_url" text,
        "verified" boolean NOT NULL DEFAULT false,
        "verified_by_user_id" uuid,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guest_identity_documents_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_guest_identity_documents_property_id" ON "guest_identity_documents" ("property_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guest_identity_documents_guest_id" ON "guest_identity_documents" ("guest_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guest_identity_documents_reservation_id" ON "guest_identity_documents" ("reservation_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "guest_identity_documents"
      ADD CONSTRAINT "FK_guest_identity_documents_property_id"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "guest_identity_documents"
      ADD CONSTRAINT "FK_guest_identity_documents_guest_id"
      FOREIGN KEY ("guest_id") REFERENCES "guests"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "guest_identity_documents"
      ADD CONSTRAINT "FK_guest_identity_documents_reservation_id"
      FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guest_identity_documents" DROP CONSTRAINT "FK_guest_identity_documents_reservation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_identity_documents" DROP CONSTRAINT "FK_guest_identity_documents_guest_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_identity_documents" DROP CONSTRAINT "FK_guest_identity_documents_property_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_guest_identity_documents_reservation_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guest_identity_documents_guest_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guest_identity_documents_property_id"`);
    await queryRunner.query(`DROP TABLE "guest_identity_documents"`);
    await queryRunner.query(`DROP TYPE "public"."guest_identity_documents_id_type_enum"`);
    await queryRunner.query(`
      ALTER TABLE "reservations"
      DROP COLUMN "c_form_status",
      DROP COLUMN "c_form_required",
      DROP COLUMN "visa_expiry_date",
      DROP COLUMN "visa_issue_date",
      DROP COLUMN "visa_type",
      DROP COLUMN "visa_number_masked",
      DROP COLUMN "passport_expiry_date",
      DROP COLUMN "passport_issue_date",
      DROP COLUMN "passport_issue_place",
      DROP COLUMN "passport_number_masked",
      DROP COLUMN "is_foreign_national",
      DROP COLUMN "payment_review_notes",
      DROP COLUMN "payment_method",
      DROP COLUMN "payment_reviewed"
    `);
    await queryRunner.query(`DROP TYPE "public"."reservations_c_form_status_enum"`);
    await queryRunner.query(`
      ALTER TABLE "guests"
      DROP COLUMN "next_destination",
      DROP COLUMN "arrival_from",
      DROP COLUMN "purpose_of_visit",
      DROP COLUMN "postal_code",
      DROP COLUMN "country",
      DROP COLUMN "state",
      DROP COLUMN "city",
      DROP COLUMN "address_line_2",
      DROP COLUMN "address_line_1"
    `);
  }
}
