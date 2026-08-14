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
import { ChildPricingMode } from '../domain/child-pricing-mode.enum';
import { GuestPricingPolicyEntity } from './guest-pricing-policy.entity';

@Entity({ name: 'child_age_bands' })
@Index('IDX_child_age_bands_policy_id', ['guestPricingPolicyId'])
@Index('UQ_child_age_bands_policy_age_range', ['guestPricingPolicyId', 'minAge', 'maxAge'], {
  unique: true,
})
@Check('CHK_child_age_bands_min_age', 'min_age >= 0')
@Check('CHK_child_age_bands_age_range', 'max_age >= min_age')
@Check(
  'CHK_child_age_bands_fixed_amount',
  `(pricing_mode <> 'FIXED_PER_NIGHT' OR fixed_amount IS NOT NULL)`,
)
@Check(
  'CHK_child_age_bands_percentage',
  `(pricing_mode <> 'PERCENT_OF_ROOM_RATE' OR percentage IS NOT NULL)`,
)
@Check(
  'CHK_child_age_bands_percentage_range',
  `(percentage IS NULL OR (percentage >= 0 AND percentage <= 100))`,
)
@Check(
  'CHK_child_age_bands_fixed_amount_non_negative',
  `(fixed_amount IS NULL OR fixed_amount >= 0)`,
)
export class ChildAgeBandEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'guest_pricing_policy_id' })
  guestPricingPolicyId!: string;

  @ManyToOne(() => GuestPricingPolicyEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'guest_pricing_policy_id' })
  guestPricingPolicy!: GuestPricingPolicyEntity;

  @Column({ type: 'varchar', length: 80 })
  label!: string;

  @Column({ type: 'integer', name: 'min_age' })
  minAge!: number;

  @Column({ type: 'integer', name: 'max_age' })
  maxAge!: number;

  @Column({
    type: 'enum',
    enum: ChildPricingMode,
    name: 'pricing_mode',
  })
  pricingMode!: ChildPricingMode;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'fixed_amount',
    nullable: true,
  })
  fixedAmount!: string | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  percentage!: string | null;

  @Column({
    type: 'integer',
    name: 'display_order',
    default: 0,
  })
  displayOrder!: number;

  @Column({
    type: 'boolean',
    name: 'is_active',
    default: true,
  })
  isActive!: boolean;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    name: 'updated_at',
  })
  updatedAt!: Date;
}
