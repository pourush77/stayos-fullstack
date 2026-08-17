import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * ARI-style sale restriction for a (property, roomType, date), with an optional
 * rate-plan scope. rate_plan_id NULL = the roomType-level baseline (all plans);
 * a rate-plan row overrides per-field (NULL field = inherit baseline). Nullable
 * booleans give tri-state: NULL inherit, true close, false explicitly reopen for
 * that plan. Read-only engine input — never mutates inventory/pricing/snapshots.
 */
@Entity({ name: 'rate_restrictions' })
@Index('IDX_rate_restrictions_lookup', ['propertyId', 'roomTypeId', 'date'])
export class RateRestrictionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @Column({ type: 'uuid', name: 'room_type_id' })
  roomTypeId!: string;

  @Column({ type: 'uuid', name: 'rate_plan_id', nullable: true })
  ratePlanId!: string | null;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'boolean', name: 'stop_sell', nullable: true })
  stopSell!: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  cta!: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  ctd!: boolean | null;

  @Column({ type: 'integer', name: 'min_stay', nullable: true })
  minStay!: number | null;

  @Column({ type: 'integer', name: 'max_stay', nullable: true })
  maxStay!: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
