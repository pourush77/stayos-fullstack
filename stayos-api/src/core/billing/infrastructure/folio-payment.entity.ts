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

@Entity({ name: 'folio_payments' })
@Index('IDX_folio_payments_folio_id', ['folioId'])
@Index('IDX_folio_payments_received_at', ['receivedAt'])
export class FolioPaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'folio_id' })
  folioId!: string;

  @ManyToOne(() => FolioEntity, (folio) => folio.payments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'folio_id' })
  folio!: FolioEntity;

  @Column({ type: 'enum', enum: FolioPaymentMethod })
  method!: FolioPaymentMethod;

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

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
