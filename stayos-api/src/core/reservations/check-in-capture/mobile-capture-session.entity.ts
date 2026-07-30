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
import { ReservationEntity } from '../infrastructure/reservation.entity';

export enum MobileCaptureSessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

@Entity({ name: 'mobile_capture_sessions' })
@Index('IDX_mobile_capture_sessions_token', ['token'], { unique: true })
@Index('IDX_mobile_capture_sessions_reservation_id', ['reservationId'])
@Index('IDX_mobile_capture_sessions_active_reservation', ['reservationId'], {
  unique: true,
  where: `"status" = 'ACTIVE'`,
})
export class MobileCaptureSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'uuid', name: 'reservation_id' })
  reservationId!: string;

  @ManyToOne(() => ReservationEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reservation_id' })
  reservation!: ReservationEntity;

  @Column({ type: 'varchar', length: 64 })
  token!: string;

  @Column({ type: 'varchar', length: 24, default: MobileCaptureSessionStatus.ACTIVE })
  status!: MobileCaptureSessionStatus;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
