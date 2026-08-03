import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { GroupBookingEntity } from './group-booking.entity';

@Entity({ name: 'group_booking_rooming_list' })
@Index('IDX_group_booking_rooming_list_group_id', ['groupBookingId'])
export class GroupBookingRoomingListEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'group_booking_id' })
  groupBookingId!: string;

  @ManyToOne(() => GroupBookingEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_booking_id' })
  groupBooking!: GroupBookingEntity;

  @Column({ type: 'varchar', length: 160, name: 'guest_name' })
  guestName!: string;

  @Column({ type: 'integer', default: 1 })
  adults!: number;

  @Column({ type: 'integer', default: 0 })
  children!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid', name: 'assigned_room_id', nullable: true })
  assignedRoomId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
