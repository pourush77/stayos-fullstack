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
 * A pricing channel for a property (for example BAR) that can price
 * multiple room types.
 */
@Entity({ name: 'rate_plans' })
@Index('UQ_rate_plans_property_code', ['propertyId', 'code'], {
  unique: true,
})
@Index('UQ_rate_plans_property_default', ['propertyId'], {
  unique: true,
  where: '"is_default" = true',
})
export class RatePlanEntity {
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

  @Column({ type: 'varchar', length: 32 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'boolean',
    name: 'is_default',
    default: false,
  })
  isDefault!: boolean;

  @Column({
    type: 'enum',
    enum: RatePlanStatus,
    default: RatePlanStatus.ACTIVE,
  })
  status!: RatePlanStatus;

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
