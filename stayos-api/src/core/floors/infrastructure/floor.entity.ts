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
import { FloorStatus } from '../domain/floor-status.enum';

@Entity({ name: 'floors' })
@Index('UQ_floors_property_code', ['propertyId', 'code'], { unique: true })
@Index('UQ_floors_property_floor_number', ['propertyId', 'floorNumber'], {
  unique: true,
})
export class FloorEntity {
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

  @Column({ type: 'integer', name: 'floor_number' })
  floorNumber!: number;

  @Column({ type: 'integer', name: 'display_order', default: 0 })
  displayOrder!: number;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: FloorStatus,
    default: FloorStatus.ACTIVE,
  })
  status!: FloorStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
