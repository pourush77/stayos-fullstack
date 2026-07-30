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
import { UserSessionStatus } from '../domain/user-session-status.enum';
import { UserEntity } from './user.entity';

@Entity({ name: 'user_sessions' })
@Index('IDX_user_sessions_refresh_token_hash', ['refreshTokenHash'])
export class UserSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'uuid', name: 'property_id', nullable: true })
  propertyId!: string | null;

  @ManyToOne(() => PropertyEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity | null;

  @Column({ type: 'text', name: 'refresh_token_hash' })
  refreshTokenHash!: string;

  @Column({ type: 'enum', enum: UserSessionStatus, default: UserSessionStatus.ACTIVE })
  status!: UserSessionStatus;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'varchar', length: 512, name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 160, name: 'terminal_name', nullable: true })
  terminalName!: string | null;

  @Column({ type: 'timestamptz', name: 'last_activity_at' })
  lastActivityAt!: Date;

  @Column({ type: 'timestamptz', name: 'locked_at', nullable: true })
  lockedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
