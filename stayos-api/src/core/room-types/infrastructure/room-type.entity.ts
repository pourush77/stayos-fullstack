import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { AmenityEntity } from '../../amenities/infrastructure/amenity.entity';
import { RoomTypeStatus } from '../domain/room-type-status.enum';

@Entity({ name: 'room_types' })
@Index('UQ_room_types_property_code', ['propertyId', 'code'], { unique: true })
@Check('CHK_room_types_base_occupancy', 'base_occupancy >= 1')
@Check('CHK_room_types_max_occupancy', 'max_occupancy >= base_occupancy')
@Check('CHK_room_types_max_adults', 'max_adults >= 1')
@Check('CHK_room_types_max_children', 'max_children >= 0')
@Check('CHK_room_types_size_sq_ft', 'size_sq_ft IS NULL OR size_sq_ft > 0')
export class RoomTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'varchar', length: 32 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'integer', name: 'base_occupancy' })
  baseOccupancy!: number;

  @Column({ type: 'integer', name: 'max_occupancy' })
  maxOccupancy!: number;

  @Column({ type: 'integer', name: 'max_adults' })
  maxAdults!: number;

  @Column({ type: 'integer', name: 'max_children', default: 0 })
  maxChildren!: number;

  @Column({ type: 'varchar', length: 80, name: 'bed_type', nullable: true })
  bedType!: string | null;

  @Column({ type: 'integer', name: 'size_sq_ft', nullable: true })
  sizeSqFt!: number | null;

  @Column({
    type: 'enum',
    enum: RoomTypeStatus,
    default: RoomTypeStatus.ACTIVE,
  })
  status!: RoomTypeStatus;

  @ManyToMany(() => AmenityEntity, (amenity) => amenity.roomTypes)
  @JoinTable({
    name: 'room_type_amenities',
    joinColumn: { name: 'room_type_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'amenity_id', referencedColumnName: 'id' },
  })
  amenities?: AmenityEntity[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
