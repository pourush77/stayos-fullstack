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
import { GroupBookingSource } from '../domain/group-booking-source.enum';
import { GroupBookingStatus } from '../domain/group-booking-status.enum';

@Entity({ name: 'group_bookings' })
@Index('UQ_group_bookings_property_code', ['propertyId', 'groupCode'], { unique: true })
@Index('IDX_group_bookings_property_status', ['propertyId', 'status'])
@Index('IDX_group_bookings_arrival_date', ['arrivalDate'])
@Check('CHK_group_bookings_guest_counts', 'adults >= 1 AND children >= 0')
@Check('CHK_group_bookings_date_range', 'departure_date > arrival_date')
@Check('CHK_group_bookings_deposit', 'deposit_required >= 0')
export class GroupBookingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'varchar', length: 32, name: 'group_code' })
  groupCode!: string;

  @Column({ type: 'varchar', length: 160, name: 'group_name' })
  groupName!: string;

  @Column({ type: 'varchar', length: 160, name: 'lead_name' })
  leadName!: string;

  @Column({ type: 'varchar', length: 32, name: 'lead_phone' })
  leadPhone!: string;

  @Column({ type: 'varchar', length: 160, name: 'lead_email', nullable: true })
  leadEmail!: string | null;

  @Column({ type: 'date', name: 'arrival_date' })
  arrivalDate!: string;

  @Column({ type: 'date', name: 'departure_date' })
  departureDate!: string;

  @Column({ type: 'integer' })
  adults!: number;

  @Column({ type: 'integer', default: 0 })
  children!: number;

  @Column({
    type: 'enum',
    enum: GroupBookingSource,
    default: GroupBookingSource.PHONE,
  })
  source!: GroupBookingSource;

  @Column({
    type: 'enum',
    enum: GroupBookingStatus,
    default: GroupBookingStatus.ON_HOLD,
  })
  status!: GroupBookingStatus;

  @Column({ type: 'timestamptz', name: 'release_at', nullable: true })
  releaseAt!: Date | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'deposit_required', default: 0 })
  depositRequired!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'estimated_total', default: 0 })
  estimatedTotal!: string;

  @Column({ type: 'varchar', length: 120, name: 'external_channel_id', nullable: true })
  externalChannelId!: string | null;

  @Column({ type: 'varchar', length: 40, name: 'sync_status', default: 'PMS_ONLY' })
  syncStatus!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
