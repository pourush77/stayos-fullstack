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
import { GuestStatus } from '../domain/guest-status.enum';

@Entity({ name: 'guests' })
@Index('UQ_guests_property_phone', ['propertyId', 'phone'], { unique: true })
@Index('IDX_guests_property_id', ['propertyId'])
export class GuestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'varchar', length: 120, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 120, name: 'last_name', nullable: true })
  lastName!: string | null;

  @Column({ type: 'varchar', length: 240, name: 'display_name' })
  displayName!: string;

  @Column({ type: 'varchar', length: 32 })
  phone!: string;

  @Column({ type: 'varchar', length: 32, name: 'alternate_phone', nullable: true })
  alternatePhone!: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  gender!: string | null;

  @Column({ type: 'date', name: 'date_of_birth', nullable: true })
  dateOfBirth!: string | null;

  @Column({ type: 'date', name: 'anniversary_date', nullable: true })
  anniversaryDate!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  nationality!: string | null;

  @Column({ type: 'varchar', length: 240, name: 'address_line_1', nullable: true })
  addressLine1?: string | null;

  @Column({ type: 'varchar', length: 240, name: 'address_line_2', nullable: true })
  addressLine2?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  state?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  country?: string | null;

  @Column({ type: 'varchar', length: 24, name: 'postal_code', nullable: true })
  postalCode?: string | null;

  @Column({ type: 'varchar', length: 160, name: 'purpose_of_visit', nullable: true })
  purposeOfVisit?: string | null;

  @Column({ type: 'varchar', length: 160, name: 'arrival_from', nullable: true })
  arrivalFrom?: string | null;

  @Column({ type: 'varchar', length: 160, name: 'next_destination', nullable: true })
  nextDestination?: string | null;

  @Column({ type: 'varchar', length: 64, name: 'preferred_language', nullable: true })
  preferredLanguage!: string | null;

  @Column({ type: 'varchar', length: 160, name: 'room_preference', nullable: true })
  roomPreference?: string | null;

  @Column({ type: 'varchar', length: 64, name: 'bed_preference', nullable: true })
  bedPreference?: string | null;

  @Column({ type: 'varchar', length: 64, name: 'smoking_preference', nullable: true })
  smokingPreference?: string | null;

  @Column({ type: 'varchar', length: 160, name: 'floor_preference', nullable: true })
  floorPreference?: string | null;

  @Column({ type: 'text', name: 'dietary_notes', nullable: true })
  dietaryNotes?: string | null;

  @Column({ type: 'varchar', length: 160, name: 'company_name', nullable: true })
  companyName!: string | null;

  @Column({ type: 'varchar', length: 15, name: 'gst_number', nullable: true })
  gstNumber!: string | null;

  @Column({ type: 'boolean', name: 'vip_status', default: false })
  vipStatus!: boolean;

  @Column({ type: 'boolean', name: 'blacklist_status', default: false })
  blacklistStatus!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    type: 'enum',
    enum: GuestStatus,
    default: GuestStatus.ACTIVE,
  })
  status!: GuestStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
