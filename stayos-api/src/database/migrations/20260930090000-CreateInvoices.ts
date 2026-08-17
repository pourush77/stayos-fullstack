import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1D-e: immutable GST invoices + credit notes and property-scoped,
 * FY-aware, concurrency-safe numbering. `invoice_number_counters` is an atomic
 * per (property, series, fy_label) counter (INSERT .. ON CONFLICT DO UPDATE
 * RETURNING) — never count()+1. A partial unique index enforces at most one
 * non-void TAX_INVOICE per folio (idempotent finalization).
 */
export class CreateInvoices20260930090000 implements MigrationInterface {
  name = 'CreateInvoices20260930090000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice_number_counters" (
        "property_id" uuid NOT NULL,
        "series" varchar(20) NOT NULL,
        "fy_label" varchar(16) NOT NULL DEFAULT '',
        "last_value" integer NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice_number_counters" PRIMARY KEY ("property_id", "series", "fy_label")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "property_id" uuid NOT NULL,
        "folio_id" uuid NOT NULL,
        "reservation_id" uuid NOT NULL,
        "guest_id" uuid NOT NULL,
        "type" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
        "invoice_number" varchar(40),
        "fy_label" varchar(16),
        "currency" varchar(3) NOT NULL DEFAULT 'INR',
        "place_of_supply" varchar(20),
        "grand_total" numeric(12,2) NOT NULL DEFAULT 0,
        "seller" jsonb NOT NULL,
        "buyer" jsonb NOT NULL,
        "reservation" jsonb NOT NULL,
        "lines" jsonb NOT NULL,
        "totals" jsonb NOT NULL,
        "payments" jsonb NOT NULL DEFAULT '[]',
        "settled_at" timestamptz,
        "original_invoice_id" uuid,
        "void_reason" text,
        "idempotency_key" varchar(120),
        "created_by_user_id" uuid,
        "issued_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invoices_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invoices_folio" FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invoices_original" FOREIGN KEY ("original_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_property" ON "invoices" ("property_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_folio" ON "invoices" ("folio_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_original" ON "invoices" ("original_invoice_id")`);
    // At most one active (non-void) TAX_INVOICE per folio -> idempotent finalize.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoices_active_tax_per_folio" ON "invoices" ("folio_id") WHERE "type" = 'TAX_INVOICE' AND "status" <> 'VOID'`,
    );
    // Unique invoice number per property+series (across finalized docs).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoices_number" ON "invoices" ("property_id", "invoice_number") WHERE "invoice_number" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_invoices_number"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_invoices_active_tax_per_folio"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_number_counters"`);
  }
}
