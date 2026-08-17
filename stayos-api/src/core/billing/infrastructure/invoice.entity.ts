import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InvoiceType } from '../domain/invoice-type.enum';
import { InvoiceStatus } from '../domain/invoice-status.enum';
import {
  InvoiceBuyerSnapshot,
  InvoiceLineSnapshot,
  InvoicePaymentSnapshot,
  InvoiceReservationSnapshot,
  InvoiceSellerSnapshot,
  InvoiceTotalsSnapshot,
} from '../invoice-snapshot';

/**
 * Immutable tax invoice / credit note. Once FINALIZED it is never edited or
 * deleted; corrections are made by issuing a linked CREDIT_NOTE. All human /
 * financial content is snapshotted into JSONB so issued documents reproduce
 * forever regardless of later folio/tax/property changes.
 */
@Entity({ name: 'invoices' })
@Index('IDX_invoices_property', ['propertyId'])
@Index('IDX_invoices_folio', ['folioId'])
@Index('IDX_invoices_original', ['originalInvoiceId'])
export class InvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @Column({ type: 'uuid', name: 'folio_id' })
  folioId!: string;

  @Column({ type: 'uuid', name: 'reservation_id' })
  reservationId!: string;

  @Column({ type: 'uuid', name: 'guest_id' })
  guestId!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: InvoiceType;

  @Column({ type: 'varchar', length: 20, default: InvoiceStatus.DRAFT })
  status!: InvoiceStatus;

  @Column({ type: 'varchar', length: 40, name: 'invoice_number', nullable: true })
  invoiceNumber!: string | null;

  @Column({ type: 'varchar', length: 16, name: 'fy_label', nullable: true })
  fyLabel!: string | null;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ type: 'varchar', length: 20, name: 'place_of_supply', nullable: true })
  placeOfSupply!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'grand_total', default: '0' })
  grandTotal!: string;

  @Column({ type: 'jsonb' })
  seller!: InvoiceSellerSnapshot;

  @Column({ type: 'jsonb' })
  buyer!: InvoiceBuyerSnapshot;

  @Column({ type: 'jsonb' })
  reservation!: InvoiceReservationSnapshot;

  @Column({ type: 'jsonb' })
  lines!: InvoiceLineSnapshot[];

  @Column({ type: 'jsonb' })
  totals!: InvoiceTotalsSnapshot;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  payments!: InvoicePaymentSnapshot[];

  @Column({ type: 'timestamptz', name: 'settled_at', nullable: true })
  settledAt!: Date | null;

  @Column({ type: 'uuid', name: 'original_invoice_id', nullable: true })
  originalInvoiceId!: string | null;

  @Column({ type: 'text', name: 'void_reason', nullable: true })
  voidReason!: string | null;

  @Column({ type: 'varchar', length: 120, name: 'idempotency_key', nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @Column({ type: 'timestamptz', name: 'issued_at', nullable: true })
  issuedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
