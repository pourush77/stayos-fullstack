import {
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

@Entity({ name: 'guest_pricing_policies' })
@Index('UQ_guest_pricing_policies_property_id', ['propertyId'], {
  unique: true,
})
export class GuestPricingPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({
    type: 'boolean',
    name: 'age_based_child_pricing_enabled',
    default: true,
  })
  ageBasedChildPricingEnabled!: boolean;

  @Column({
    type: 'integer',
    name: 'maximum_child_age',
    default: 17,
  })
  maximumChildAge!: number;

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
