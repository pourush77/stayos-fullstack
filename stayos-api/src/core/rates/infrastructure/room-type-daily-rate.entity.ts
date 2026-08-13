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
 * The priced amount for a single room type, under a single rate plan, on a single stay date.
 * This is the smallest unit of the pricing calendar and is intentionally decoupled from
 * reservations/billing: it only describes what a stay *should* cost, not what was booked or charged.
 */
@Entity({ name: 'room_type_daily_rates' })
@Index(
  'UQ_room_type_daily_rates_room_type_rate_plan_stay_date',
  ['roomTypeId', 'ratePlanId', 'stayDate'],
  { unique: true },
)
@Check('CHK_room_type_daily_rates_amount', 'amount >= 0')
export class RoomTypeDailyRateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'uuid', name: 'room_type_id' })
  roomTypeId!: string;

  @ManyToOne(() => RoomTypeEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_type_id' })
  roomType!: RoomTypeEntity;

  @Column({ type: 'uuid', name: 'rate_plan_id' })
  ratePlanId!: string;

  // Rate plans are commercial master data (ACTIVE/INACTIVE); deactivate instead of deleting, so RESTRICT prevents
  // dropping a rate plan while priced daily rates still reference it.
  @ManyToOne(() => RatePlanEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rate_plan_id' })
  ratePlan!: RatePlanEntity;

  @Column({ type: 'date', name: 'stay_date' })
  stayDate!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
