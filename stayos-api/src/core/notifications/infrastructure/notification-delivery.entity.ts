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
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { NotificationChannel } from '../domain/notification-channel.enum';
import { NotificationStatus } from '../domain/notification-status.enum';
import { NotificationType } from '../domain/notification-type.enum';

@Entity({ name: 'notification_deliveries' })
@Index('UQ_notification_deliveries_dedupe_key', ['dedupeKey'], { unique: true })
@Index('IDX_notification_deliveries_property_id', ['propertyId'])
@Index('IDX_notification_deliveries_status_next_attempt', ['status', 'nextAttemptAt'])
@Index('IDX_notification_deliveries_property_entity', ['propertyId', 'entityType', 'entityId'])
export class NotificationDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
  })
  channel!: NotificationChannel;

  @Column({
    type: 'enum',
    enum: NotificationType,
    name: 'notification_type',
  })
  notificationType!: NotificationType;

  @Column({ type: 'varchar', length: 32, name: 'entity_type' })
  entityType!: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'varchar', length: 320 })
  recipient!: string;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  provider!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'provider_message_id', nullable: true })
  providerMessageId!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'dedupe_key' })
  dedupeKey!: string;

  @Column({ type: 'integer', name: 'attempt_count', default: 0 })
  attemptCount!: number;

  @Column({ type: 'timestamptz', name: 'next_attempt_at', nullable: true })
  nextAttemptAt!: Date | null;

  @Column({ type: 'text', name: 'last_error', nullable: true })
  lastError!: string | null;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
