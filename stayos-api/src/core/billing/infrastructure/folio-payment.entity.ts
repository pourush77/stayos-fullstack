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
import { FolioPaymentMethod } from '../domain/folio-payment-method.enum';
import { FolioPaymentType } from '../domain/folio-payment-type.enum';
import { GroupMasterFolioEntity } from '../../operations/infrastructure/group-master-folio.entity';

@Entity({ name: 'folio_payments' })
@Index('IDX_folio_payments_folio_id', ['folioId'])
@Index('IDX_folio_payments_group_master_folio_id', ['groupMasterFolioId'])
@Index('IDX_folio_payments_received_at', ['receivedAt'])
export class FolioPaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'folio_id', nullable: true })
  folioId!: string | null;

  @ManyToOne(() => FolioEntity, (folio) => folio.payments, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'folio_id' })
  folio!: FolioEntity | null;

  @Column({ type: 'uuid', name: 'group_master_folio_id', nullable: true })
  groupMasterFolioId!: string | null;

  @ManyToOne(() => GroupMasterFolioEntity, (folio) => folio.payments, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_master_folio_id' })
  groupMasterFolio!: GroupMasterFolioEntity | null;

  @Column({ type: 'enum', enum: FolioPaymentMethod })
  method!: FolioPaymentMethod;

  // Ledger direction. REFUND rows store a NEGATIVE amount and link to the
  // original via reversalOfPaymentId. Append-only: originals are never edited.
  @Column({ type: 'varchar', length: 20, default: FolioPaymentType.PAYMENT })
  type!: FolioPaymentType;

  @Column({ type: 'uuid', name: 'reversal_of_payment_id', nullable: true })
  reversalOfPaymentId!: string | null;

  // Idempotency key (unique per folio) so a retried request cannot duplicate money.
  @Column({ type: 'varchar', length: 120, name: 'idempotency_key', nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamptz', name: 'received_at' })
  receivedAt!: Date;

  @Column({ type: 'uuid', name: 'received_by_user_id', nullable: true })
  receivedByUserId!: string | null;

  @Column({ type: 'date', name: 'business_date', nullable: true })
  businessDate!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
