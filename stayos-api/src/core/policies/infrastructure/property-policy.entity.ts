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
import { GroupBookingDepositPolicyType } from '../../properties/domain/group-booking-deposit-policy-type.enum';
import { PolicyChargeMode } from '../domain/policy-charge-mode.enum';
import { PropertyPolicyType } from '../domain/property-policy-type.enum';

/**
 * A single, structured policy for a property. One row per (property, policyType)
 * at the property-default level (rate_plan_id IS NULL). A nullable rate_plan_id
 * keeps the future Property default -> Rate Plan override hierarchy possible
 * without implementing rate plans here.
 */
@Entity({ name: 'property_policies' })
@Index('IDX_property_policies_property_id', ['propertyId'])
@Check('CHK_property_policies_deposit_value', 'deposit_value IS NULL OR deposit_value >= 0')
@Check('CHK_property_policies_charge_value', 'charge_value IS NULL OR charge_value >= 0')
export class PropertyPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'uuid', name: 'rate_plan_id', nullable: true })
  ratePlanId!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'policy_type' })
  policyType!: PropertyPolicyType;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 16, name: 'deposit_mode', nullable: true })
  depositMode!: GroupBookingDepositPolicyType | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'deposit_value', nullable: true })
  depositValue!: string | null;

  @Column({ type: 'varchar', length: 16, name: 'charge_mode', nullable: true })
  chargeMode!: PolicyChargeMode | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'charge_value', nullable: true })
  chargeValue!: string | null;

  @Column({ type: 'integer', name: 'cancellation_cutoff_hours', nullable: true })
  cancellationCutoffHours!: number | null;

  @Column({ type: 'integer', name: 'grace_minutes', nullable: true })
  graceMinutes!: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
