import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReservationRateSnapshotStatus } from '../domain/reservation-rate-snapshot-status.enum';
import { ReservationRateSnapshotTrigger } from '../domain/reservation-rate-snapshot-trigger.enum';

/**
 * Append-only, immutable commercial snapshot history for a reservation.
 * Exactly one ACTIVE row per reservation (partial unique index). A commercial
 * amendment supersedes the current ACTIVE row and inserts a new version — old
 * versions are never rewritten. The reservation carries a backward-compatible
 * mirror (rate_snapshot / rate_plan_id / rate_snapshot_version) of the ACTIVE
 * row. Pricing only — never touches inventory.
 */
@Entity({ name: 'reservation_rate_snapshots' })
@Index('UQ_rrs_reservation_version', ['reservationId', 'version'], { unique: true })
@Index('IDX_rrs_reservation_id', ['reservationId'])
@Index('IDX_rrs_property_id', ['propertyId'])
export class ReservationRateSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'reservation_id' })
  reservationId!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @Column({ type: 'integer' })
  version!: number;

  @Column({
    type: 'enum',
    enum: ReservationRateSnapshotStatus,
    enumName: 'reservation_rate_snapshot_status_enum',
  })
  status!: ReservationRateSnapshotStatus;

  @Column({
    type: 'enum',
    enum: ReservationRateSnapshotTrigger,
    enumName: 'reservation_rate_snapshot_trigger_enum',
    name: 'trigger',
  })
  trigger!: ReservationRateSnapshotTrigger;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'uuid', name: 'rate_plan_id', nullable: true })
  ratePlanId!: string | null;

  @Column({ type: 'varchar', length: 64, name: 'commercial_input_hash' })
  commercialInputHash!: string;

  @Column({ type: 'jsonb' })
  snapshot!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'effective_from' })
  effectiveFrom!: Date;

  @Column({ type: 'timestamptz', name: 'superseded_at', nullable: true })
  supersededAt!: Date | null;

  @Column({ type: 'integer', name: 'superseded_by_version', nullable: true })
  supersededByVersion!: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
