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
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';
import { RatePlanEntity } from './rate-plan.entity';

/**
 * The room types a rate plan applies to, plus the base commercial terms per
 * room type: base occupancy, base rate, and extra adult/child per-night charges.
 *
 * Pricing only — never touches inventory. Base rate is the fallback used when
 * no date-wise override (room_type_daily_rates) exists for a stay date.
 */
@Entity({ name: 'rate_plan_room_types' })
@Index('UQ_rate_plan_room_types_plan_room_type', ['ratePlanId', 'roomTypeId'], { unique: true })
@Index('IDX_rate_plan_room_types_property_id', ['propertyId'])
@Index('IDX_rate_plan_room_types_room_type_id', ['roomTypeId'])
@Check('CHK_rate_plan_room_types_base_occupancy', 'base_occupancy >= 1')
@Check('CHK_rate_plan_room_types_base_rate', 'base_rate >= 0')
@Check('CHK_rate_plan_room_types_extra_adult', 'extra_adult_charge >= 0')
@Check('CHK_rate_plan_room_types_extra_child', 'extra_child_charge >= 0')
export class RatePlanRoomTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'uuid', name: 'rate_plan_id' })
  ratePlanId!: string;

  @ManyToOne(() => RatePlanEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rate_plan_id' })
  ratePlan!: RatePlanEntity;

  @Column({ type: 'uuid', name: 'room_type_id' })
  roomTypeId!: string;

  @ManyToOne(() => RoomTypeEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_type_id' })
  roomType!: RoomTypeEntity;

  @Column({ type: 'integer', name: 'base_occupancy', default: 2 })
  baseOccupancy!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'base_rate' })
  baseRate!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'extra_adult_charge', default: 0 })
  extraAdultCharge!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'extra_child_charge', default: 0 })
  extraChildCharge!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
