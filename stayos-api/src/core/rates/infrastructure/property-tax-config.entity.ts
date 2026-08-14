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

@Entity({ name: 'property_tax_configs' })
@Index('UQ_property_tax_configs_property_id', ['propertyId'], { unique: true })
@Check('CHK_property_tax_configs_percentage_range', 'percentage >= 0 AND percentage <= 100')
@Check(
  'CHK_property_tax_configs_active_name',
  "is_active = false OR length(trim(name)) > 0",
)
export class PropertyTaxConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'varchar', length: 80, default: 'GST' })
  name!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: '0' })
  percentage!: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
