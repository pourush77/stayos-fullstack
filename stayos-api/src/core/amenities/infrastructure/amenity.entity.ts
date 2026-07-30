import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';
import { AmenityCategory } from '../domain/amenity-category.enum';

@Entity({ name: 'amenities' })
@Index('UQ_amenities_property_code', ['propertyId', 'code'], { unique: true })
export class AmenityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  label!: string;

  @Column({ type: 'enum', enum: AmenityCategory })
  category!: AmenityCategory;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @ManyToMany(() => RoomTypeEntity, (roomType) => roomType.amenities)
  roomTypes?: RoomTypeEntity[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
