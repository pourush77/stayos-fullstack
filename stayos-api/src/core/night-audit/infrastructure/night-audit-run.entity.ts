import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { UserEntity } from '../../auth/infrastructure/user.entity';
import { NightAuditRunStatus } from '../domain/night-audit-run-status.enum';

import type { NightAuditCompletionSnapshot } from '../snapshots/night-audit-completion-snapshot';

@Entity({ name: 'night_audit_runs' })
@Unique('UQ_night_audit_runs_property_business_date', ['propertyId', 'businessDate'])
@Index('UQ_night_audit_runs_property_open', ['propertyId'], {
  unique: true,
  where: `"status" = 'OPEN'`,
})
export class NightAuditRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property?: PropertyEntity;

  @Column({ type: 'date', name: 'business_date' })
  businessDate!: string;

  @Column({
    type: 'enum',
    enum: NightAuditRunStatus,
    default: NightAuditRunStatus.OPEN,
  })
  status!: NightAuditRunStatus;

  @Column({ type: 'uuid', name: 'started_by_user_id' })
  startedByUserId!: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'started_by_user_id' })
  startedByUser?: UserEntity;

  @Column({ type: 'timestamptz', name: 'started_at' })
  startedAt!: Date;

  @Column({ type: 'uuid', name: 'completed_by_user_id', nullable: true })
  completedByUserId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'completed_by_user_id' })
  completedByUser?: UserEntity | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  summary!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', name: 'completion_snapshot', nullable: true })
  completionSnapshot!: NightAuditCompletionSnapshot | null;

  @Column({ type: 'varchar', name: 'completion_snapshot_version', nullable: true })
  completionSnapshotVersion!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
