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
 * Configurable, effective-dated Indian GST rule (Phase 1D-c). Keyed by
 * (property, charge type) with an optional per-unit tariff slab range
 * [slabMinAmount, slabMaxAmount] (e.g. room rate <= 7500/night => rate X). No
 * statutory rates are hardcoded: a property configures its own rules. When a
 * charge is posted, the applicable rule (greatest effectiveFrom <= charge date
 * whose slab contains the per-unit basis) is resolved and FROZEN onto the
 * charge as a TaxSnapshot, so historical charges never shift if rules change.
 */
@Entity({ name: 'tax_rules' })
@Index('IDX_tax_rules_lookup', ['propertyId', 'chargeType', 'isActive'])
@Check('CHK_tax_rules_percentage_range', 'tax_percentage >= 0 AND tax_percentage <= 100')
@Check(
  'CHK_tax_rules_slab_bounds',
  'slab_min_amount IS NULL OR slab_max_amount IS NULL OR slab_min_amount <= slab_max_amount',
)
export class TaxRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  // FolioChargeType value (varchar, not a PG enum, to avoid cross-module enum coupling).
  @Column({ type: 'varchar', length: 40, name: 'charge_type' })
  chargeType!: string;

  @Column({ type: 'varchar', length: 16, name: 'hsn_sac', nullable: true })
  hsnSac!: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'tax_percentage' })
  taxPercentage!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'slab_min_amount', nullable: true })
  slabMinAmount!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'slab_max_amount', nullable: true })
  slabMaxAmount!: string | null;

  @Column({ type: 'date', name: 'effective_from' })
  effectiveFrom!: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
