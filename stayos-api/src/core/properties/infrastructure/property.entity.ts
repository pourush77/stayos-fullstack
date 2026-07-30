import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PropertyStatus } from '../domain/property-status.enum';

@Entity({ name: 'properties' })
export class PropertyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 200, name: 'legal_name' })
  legalName!: string;

  @Column({ type: 'varchar', length: 15, name: 'gst_number' })
  gstNumber!: string;

  @Column({ type: 'varchar', length: 10, name: 'pan_number', nullable: true })
  panNumber!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'cin_number', nullable: true })
  cinNumber!: string | null;

  @Column({ type: 'varchar', length: 512, name: 'logo_url', nullable: true })
  logoUrl!: string | null;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 32 })
  phone!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'address_line_1' })
  addressLine1!: string;

  @Column({ type: 'varchar', length: 255, name: 'address_line_2', nullable: true })
  addressLine2!: string | null;

  @Column({ type: 'varchar', length: 120 })
  city!: string;

  @Column({ type: 'varchar', length: 120 })
  state!: string;

  @Column({ type: 'varchar', length: 2, name: 'state_code' })
  stateCode!: string;

  @Column({ type: 'varchar', length: 120 })
  country!: string;

  @Column({ type: 'varchar', length: 16, name: 'postal_code' })
  postalCode!: string;

  @Column({ type: 'varchar', length: 64 })
  timezone!: string;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @Column({ type: 'time without time zone', name: 'check_in_time' })
  checkInTime!: string; //2:00pm checkin 12:00pm chekout

  @Column({ type: 'time without time zone', name: 'check_out_time' })
  checkOutTime!: string;

  @Column({ type: 'integer', name: 'total_floors', default: 0 })
  totalFloors!: number; //2;

  @Column({ type: 'integer', name: 'total_rooms', default: 0 })
  totalRooms!: number; //24 12-12

  @Column({
    type: 'enum',
    enum: PropertyStatus,
    default: PropertyStatus.ACTIVE,
  })
  status!: PropertyStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
