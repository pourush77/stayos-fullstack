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
import { FloorEntity } from '../../floors/infrastructure/floor.entity';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';
import { EmployeeEntity } from '../../employees/infrastructure/employee.entity';
import { RoomOperationalStatus } from '../domain/room-operational-status.enum';
import { RoomStatus } from '../domain/room-status.enum';

@Entity({ name: 'rooms' })
@Index('UQ_rooms_property_room_number', ['propertyId', 'roomNumber'], {
  unique: true,
})
export class RoomEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'uuid', name: 'floor_id' })
  floorId!: string;

  @ManyToOne(() => FloorEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'floor_id' })
  floor!: FloorEntity;

  @Column({ type: 'uuid', name: 'room_type_id' })
  roomTypeId!: string;

  @ManyToOne(() => RoomTypeEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_type_id' })
  roomType!: RoomTypeEntity;

  @Column({ type: 'varchar', length: 32, name: 'room_number' })
  roomNumber!: string;

  @Column({ type: 'varchar', length: 120, name: 'display_name', nullable: true })
  displayName!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.ACTIVE,
  })
  status!: RoomStatus;

  @Column({
    type: 'enum',
    enum: RoomOperationalStatus,
    name: 'operational_status',
    default: RoomOperationalStatus.READY,
  })
  operationalStatus!: RoomOperationalStatus;

  @Column({ type: 'varchar', length: 120, name: 'operational_status_reason', nullable: true })
  operationalStatusReason!: string | null;

  @Column({ type: 'text', name: 'operational_status_note', nullable: true })
  operationalStatusNote!: string | null;

  @Column({ type: 'uuid', name: 'assigned_employee_id', nullable: true })
  assignedEmployeeId?: string | null;

  @ManyToOne(() => EmployeeEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_employee_id' })
  assignedEmployee?: EmployeeEntity | null;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'timestamptz', name: 'inspected_at', nullable: true })
  inspectedAt?: Date | null;

  @Column({ type: 'boolean', name: 'completed_on_behalf', default: false })
  completedOnBehalf?: boolean;

  @Column({ type: 'uuid', name: 'completed_by_employee_id', nullable: true })
  completedByEmployeeId?: string | null;

  @Column({ type: 'uuid', name: 'completed_by_user_id', nullable: true })
  completedByUserId?: string | null;

  @Column({ type: 'uuid', name: 'inspected_by_user_id', nullable: true })
  inspectedByUserId?: string | null;

  @Column({ type: 'jsonb', default: [] })
  checklist?: Record<string, unknown>[];

  @Column({ type: 'text', name: 'rework_reason', nullable: true })
  reworkReason?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
