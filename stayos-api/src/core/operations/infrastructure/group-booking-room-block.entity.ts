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
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';
import { GroupBookingEntity } from './group-booking.entity';

@Entity({ name: 'group_booking_room_blocks' })
@Index('IDX_group_booking_room_blocks_group_id', ['groupBookingId'])
@Index('IDX_group_booking_room_blocks_room_type_id', ['roomTypeId'])
@Check('CHK_group_booking_room_blocks_rooms', 'rooms > 0')
@Check('CHK_group_booking_room_blocks_rates', 'base_rate >= 0 AND estimated_total >= 0')
export class GroupBookingRoomBlockEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'group_booking_id' })
  groupBookingId!: string;

  @ManyToOne(() => GroupBookingEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_booking_id' })
  groupBooking!: GroupBookingEntity;

  @Column({ type: 'uuid', name: 'room_type_id' })
  roomTypeId!: string;

  @ManyToOne(() => RoomTypeEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_type_id' })
  roomType!: RoomTypeEntity;

  @Column({ type: 'integer' })
  rooms!: number;

  @Column({ type: 'integer', name: 'adults_per_room', default: 1 })
  adultsPerRoom!: number;

  @Column({ type: 'integer', name: 'children_per_room', default: 0 })
  childrenPerRoom!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'base_rate', default: 0 })
  baseRate!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'estimated_total', default: 0 })
  estimatedTotal!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
