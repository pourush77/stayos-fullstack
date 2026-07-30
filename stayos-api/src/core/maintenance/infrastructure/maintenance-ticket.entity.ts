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
import { UserEntity } from '../../auth/infrastructure/user.entity';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { MaintenanceTicketCategory } from '../domain/maintenance-ticket-category.enum';
import { MaintenanceTicketPriority } from '../domain/maintenance-ticket-priority.enum';
import { MaintenanceTicketStatus } from '../domain/maintenance-ticket-status.enum';

@Entity({ name: 'maintenance_tickets' })
@Index('IDX_maintenance_tickets_property_status', ['propertyId', 'status'])
@Index('IDX_maintenance_tickets_room_id', ['roomId'])
export class MaintenanceTicketEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'uuid', name: 'room_id', nullable: true })
  roomId!: string | null;

  @ManyToOne(() => RoomEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'room_id' })
  room!: RoomEntity | null;

  @Column({ type: 'uuid', name: 'reported_by_user_id' })
  reportedByUserId!: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reported_by_user_id' })
  reportedBy!: UserEntity;

  @Column({ type: 'uuid', name: 'assigned_to_user_id', nullable: true })
  assignedToUserId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to_user_id' })
  assignedTo!: UserEntity | null;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: MaintenanceTicketCategory })
  category!: MaintenanceTicketCategory;

  @Column({ type: 'enum', enum: MaintenanceTicketPriority, default: MaintenanceTicketPriority.NORMAL })
  priority!: MaintenanceTicketPriority;

  @Column({ type: 'enum', enum: MaintenanceTicketStatus, default: MaintenanceTicketStatus.OPEN })
  status!: MaintenanceTicketStatus;

  @Column({ type: 'timestamptz', name: 'reported_at' })
  reportedAt!: Date;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'text', name: 'resolution_note', nullable: true })
  resolutionNote!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
