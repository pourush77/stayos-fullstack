import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FolioEntity } from './folio.entity';
import { FolioChargeType } from '../domain/folio-charge-type.enum';
import { FolioChargeStatus } from '../domain/folio-charge-status.enum';
import { TaxSnapshot } from '../../rates/domain/gst.types';

@Entity({ name: 'folio_charges' })
@Index('IDX_folio_charges_folio_id', ['folioId'])
@Index('IDX_folio_charges_charged_at', ['chargedAt'])
@Index('IDX_folio_charges_reversal_of', ['reversalOfChargeId'])
export class FolioChargeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'folio_id' })
  folioId!: string;

  @ManyToOne(() => FolioEntity, (folio) => folio.charges, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'folio_id' })
  folio!: FolioEntity;

  @Column({ type: 'enum', enum: FolioChargeType })
  type!: FolioChargeType;

  @Column({ type: 'enum', enum: FolioChargeStatus, default: FolioChargeStatus.POSTED })
  status!: FolioChargeStatus;

  // Set on a REVERSAL row -> the original POSTED charge it reverses. Null for
  // ordinary POSTED/REVERSED rows.
  @Column({ type: 'uuid', name: 'reversal_of_charge_id', nullable: true })
  reversalOfChargeId!: string | null;

  // Snapshot-driven ROOM charges (1D-b) carry the reservation_rate_snapshot they
  // were generated from. NULL => legacy/manual charge (never reconciled).
  @Column({ type: 'uuid', name: 'rate_snapshot_id', nullable: true })
  rateSnapshotId!: string | null;

  @Column({ type: 'integer', name: 'rate_snapshot_version', nullable: true })
  rateSnapshotVersion!: number | null;

  @Column({ type: 'varchar', length: 160 })
  description!: string;

  @Column({ type: 'integer', default: 1 })
  quantity!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'unit_amount' })
  unitAmount!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'tax_amount', default: '0' })
  taxAmount!: string;

  // HSN/SAC code frozen on the charge (Phase 1D-c). NULL for legacy/manual
  // charges or when no GST rule applied.
  @Column({ type: 'varchar', length: 16, name: 'hsn_sac', nullable: true })
  hsnSac!: string | null;

  // Frozen GST breakdown (TaxSnapshot) that applied when this charge was posted:
  // taxable value, place of supply, CGST/SGST/IGST components + rates, and the
  // rule reference. NULL => no GST engine snapshot (legacy/manual/explicit tax).
  @Column({ type: 'jsonb', name: 'tax_snapshot', nullable: true })
  taxSnapshot!: TaxSnapshot | null;

  @Column({ type: 'timestamptz', name: 'charged_at' })
  chargedAt!: Date;

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @Column({ type: 'date', name: 'business_date', nullable: true })
  businessDate!: Date | null;

  @Column({ type: 'date', name: 'service_date', nullable: true })
  serviceDate!: Date | null;

  @Column({ type: 'varchar', length: 240, name: 'idempotency_key', nullable: true })
  idempotencyKey!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
