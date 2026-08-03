import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { GroupBookingEntity } from './group-booking.entity';

@Entity({ name: 'group_booking_room_assignments' })
@Index('UQ_group_booking_room_assignments_group_room', ['groupBookingId', 'roomId'], { unique: true })
@Index('IDX_group_booking_room_assignments_room_id', ['roomId'])
export class GroupBookingRoomAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'group_booking_id' })
  groupBookingId!: string;

  @ManyToOne(() => GroupBookingEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_booking_id' })
  groupBooking!: GroupBookingEntity;

  @Column({ type: 'uuid', name: 'room_id' })
  roomId!: string;

  @ManyToOne(() => RoomEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_id' })
  room!: RoomEntity;

  @Column({ type: 'uuid', name: 'room_type_id' })
  roomTypeId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
