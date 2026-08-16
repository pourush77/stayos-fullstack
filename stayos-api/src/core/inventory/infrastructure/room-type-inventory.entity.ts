import {
  Check,
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
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';

/**
 * Authoritative, date-grained room-type inventory ledger.
 *
 * One row per (propertyId, roomTypeId, date):
 *  - capacity = structural room-type inventory (count of physical rooms that
 *    belong to the pool). It is NOT reduced by operational/sellability concerns
 *    (DIRTY / MAINTENANCE / occupied / assigned) — those are layered separately
 *    by future OOO/room-block adjustments.
 *  - sold = inventory consumed (entitlement), not merely confirmed sales.
 *  - available = capacity - sold for this foundation slice.
 *
 * Physical roomId assignment must NEVER affect `sold`.
 */
@Entity({ name: 'room_type_inventory' })
@Index('UQ_room_type_inventory_pool_date', ['propertyId', 'roomTypeId', 'date'], { unique: true })
@Index('IDX_room_type_inventory_property_id', ['propertyId'])
@Index('IDX_room_type_inventory_room_type_id', ['roomTypeId'])
@Check('CHK_room_type_inventory_capacity', 'capacity >= 0')
@Check('CHK_room_type_inventory_sold_non_negative', 'sold >= 0')
@Check('CHK_room_type_inventory_sold_within_capacity', 'sold <= capacity')
export class RoomTypeInventoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'uuid', name: 'room_type_id' })
  roomTypeId!: string;

  @ManyToOne(() => RoomTypeEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_type_id' })
  roomType!: RoomTypeEntity;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'integer' })
  capacity!: number;

  @Column({ type: 'integer', default: 0 })
  sold!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
