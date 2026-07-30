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
import { EmployeeDepartment } from '../domain/employee-department.enum';
import { EmployeeStatus } from '../domain/employee-status.enum';

@Entity({ name: 'employees' })
@Index('UQ_employees_property_employee_code', ['propertyId', 'employeeCode'], { unique: true })
export class EmployeeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'varchar', length: 32, name: 'employee_code' })
  employeeCode!: string;

  @Column({ type: 'varchar', length: 120, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 120, name: 'last_name', default: '' })
  lastName!: string;

  @Column({ type: 'varchar', length: 240, name: 'display_name' })
  displayName!: string;

  @Column({ type: 'enum', enum: EmployeeDepartment })
  department!: EmployeeDepartment;

  @Column({ type: 'varchar', length: 120, default: '' })
  designation!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ type: 'enum', enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  status!: EmployeeStatus;

  @Column({ type: 'text', name: 'photo_url', nullable: true })
  photoUrl!: string | null;

  @Column({ type: 'boolean', name: 'staff_access_enabled', default: false })
  staffAccessEnabled!: boolean;

  @Column({ type: 'text', name: 'staff_access_token', nullable: true })
  staffAccessToken!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
