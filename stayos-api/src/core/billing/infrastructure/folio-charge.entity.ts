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

@Entity({ name: 'folio_charges' })
@Index('IDX_folio_charges_folio_id', ['folioId'])
@Index('IDX_folio_charges_charged_at', ['chargedAt'])
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

  @Column({ type: 'timestamptz', name: 'charged_at' })
  chargedAt!: Date;

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
