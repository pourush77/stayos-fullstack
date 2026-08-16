import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';

/**
 * Property-level billing/invoice configuration. Kept separate from tax rules so
 * tax calculation is not embedded here and invoice numbering can evolve
 * independently.
 */
@Entity({ name: 'property_billing_configs' })
@Index('UQ_property_billing_configs_property_id', ['propertyId'], { unique: true })
@Check('CHK_property_billing_configs_next_number', 'next_invoice_number >= 1')
@Check(
  'CHK_property_billing_configs_fy_month',
  'financial_year_start_month >= 1 AND financial_year_start_month <= 12',
)
export class PropertyBillingConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'varchar', length: 16, name: 'invoice_prefix', default: '' })
  invoicePrefix!: string;

  @Column({ type: 'integer', name: 'next_invoice_number', default: 1 })
  nextInvoiceNumber!: number;

  @Column({ type: 'boolean', name: 'reset_sequence_yearly', default: true })
  resetSequenceYearly!: boolean;

  @Column({ type: 'integer', name: 'financial_year_start_month', default: 4 })
  financialYearStartMonth!: number;

  @Column({ type: 'varchar', length: 16, name: 'default_hsn_sac', nullable: true })
  defaultHsnSac!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
