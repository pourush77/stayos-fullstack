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
import { RatePlanStatus } from '../domain/rate-plan-status.enum';

/**
 * A pricing channel for a property (e.g. BAR) that room types can be priced under.
 * A rate plan does not belong to a single room type: one plan can price many room types.
 */
@Entity({ name: 'rate_plans' })
@Index('UQ_rate_plans_property_code', ['propertyId', 'code'], { unique: true })
// Partial unique index: at most one is_default = true row per property (see migration for the DB-level source of truth).
@Index('UQ_rate_plans_property_default', ['propertyId'], {
  unique: true,
  where: '"is_default" = true',
})
export class RatePlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'varchar', length: 32 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({
    type: 'enum',
    enum: RatePlanStatus,
    default: RatePlanStatus.ACTIVE,
  })
  status!: RatePlanStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
