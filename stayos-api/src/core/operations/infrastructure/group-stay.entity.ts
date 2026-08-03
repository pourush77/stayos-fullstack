import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { GroupBookingEntity } from './group-booking.entity';

@Entity({ name: 'group_stays' })
@Index('UQ_group_stays_group_booking_id', ['groupBookingId'], { unique: true })
export class GroupStayEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @Column({ type: 'uuid', name: 'group_booking_id' })
  groupBookingId!: string;

  @ManyToOne(() => GroupBookingEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'group_booking_id' })
  groupBooking!: GroupBookingEntity;

  @Column({ type: 'timestamptz', name: 'checked_in_at' })
  checkedInAt!: Date;

  @Column({ type: 'varchar', length: 32, default: 'IN_HOUSE' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
