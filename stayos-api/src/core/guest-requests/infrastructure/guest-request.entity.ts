import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeEntity } from '../../employees/infrastructure/employee.entity';
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { GuestRequestDepartment } from '../domain/guest-request-department.enum';
import { GuestRequestPriority } from '../domain/guest-request-priority.enum';
import { GuestRequestStatus } from '../domain/guest-request-status.enum';
import { GuestRequestNoteEntity } from './guest-request-note.entity';

@Entity({ name: 'guest_requests' })
@Index('IDX_guest_requests_property_status', ['propertyId', 'status'])
@Index('IDX_guest_requests_property_department', ['propertyId', 'department'])
@Index('IDX_guest_requests_reservation_id', ['reservationId'])
export class GuestRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'uuid', name: 'reservation_id', nullable: true })
  reservationId!: string | null;

  @ManyToOne(() => ReservationEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reservation_id' })
  reservation!: ReservationEntity | null;

  @Column({ type: 'uuid', name: 'guest_id', nullable: true })
  guestId!: string | null;

  @ManyToOne(() => GuestEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'guest_id' })
  guest!: GuestEntity | null;

  @Column({ type: 'uuid', name: 'room_id', nullable: true })
  roomId!: string | null;

  @ManyToOne(() => RoomEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'room_id' })
  room!: RoomEntity | null;

  @Column({ type: 'uuid', name: 'assigned_employee_id', nullable: true })
  assignedEmployeeId!: string | null;

  @ManyToOne(() => EmployeeEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_employee_id' })
  assignedEmployee!: EmployeeEntity | null;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: GuestRequestStatus, default: GuestRequestStatus.REQUESTED })
  status!: GuestRequestStatus;

  @Column({ type: 'enum', enum: GuestRequestPriority, default: GuestRequestPriority.NORMAL })
  priority!: GuestRequestPriority;

  @Column({ type: 'enum', enum: GuestRequestDepartment })
  department!: GuestRequestDepartment;

  @Column({ type: 'timestamptz', name: 'due_at', nullable: true })
  dueAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'cancelled_at', nullable: true })
  cancelledAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => GuestRequestNoteEntity, (note) => note.request)
  notes!: GuestRequestNoteEntity[];
}
