import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { GroupBookingEntity } from './group-booking.entity';
import { GroupStayEntity } from './group-stay.entity';

@Entity({ name: 'group_master_folios' })
@Index('UQ_group_master_folios_group_booking_id', ['groupBookingId'], { unique: true })
export class GroupMasterFolioEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @Column({ type: 'uuid', name: 'group_booking_id' })
  groupBookingId!: string;

  @ManyToOne(() => GroupBookingEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'group_booking_id' })
  groupBooking!: GroupBookingEntity;

  @Column({ type: 'uuid', name: 'group_stay_id' })
  groupStayId!: string;

  @ManyToOne(() => GroupStayEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_stay_id' })
  groupStay!: GroupStayEntity;

  @Column({ type: 'varchar', length: 32, name: 'folio_number' })
  folioNumber!: string;

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status!: string;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'estimated_total', default: 0 })
  estimatedTotal!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
