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
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { ReservationPaymentStatus } from '../domain/reservation-payment-status.enum';
import { ReservationSource } from '../domain/reservation-source.enum';
import { ReservationStatus } from '../domain/reservation-status.enum';
import { CFormStatus } from '../domain/c-form-status.enum';

@Entity({ name: 'reservations' })
@Index('UQ_reservations_property_code', ['propertyId', 'reservationCode'], { unique: true })
@Index('IDX_reservations_property_id', ['propertyId'])
@Index('IDX_reservations_guest_id', ['guestId'])
@Index('IDX_reservations_room_type_id', ['roomTypeId'])
@Index('IDX_reservations_room_id', ['roomId'])
@Index('IDX_reservations_arrival_date', ['arrivalDate'])
@Check('CHK_reservations_guest_counts', 'adults >= 1 AND children >= 0')
@Check('CHK_reservations_date_range', 'departure_date > arrival_date')
export class ReservationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'uuid', name: 'guest_id' })
  guestId!: string;

  @ManyToOne(() => GuestEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'guest_id' })
  guest!: GuestEntity;

  @Column({ type: 'varchar', length: 32, name: 'reservation_code' })
  reservationCode!: string;

  @Column({ type: 'date', name: 'arrival_date' })
  arrivalDate!: string;

  @Column({ type: 'date', name: 'departure_date' })
  departureDate!: string;

  @Column({ type: 'integer' })
  adults!: number;

  @Column({ type: 'integer', default: 0 })
  children!: number;

  @Column({ type: 'uuid', name: 'room_type_id' })
  roomTypeId!: string;

  @ManyToOne(() => RoomTypeEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_type_id' })
  roomType!: RoomTypeEntity;

  @Column({ type: 'uuid', name: 'room_id', nullable: true })
  roomId!: string | null;

  @ManyToOne(() => RoomEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_id' })
  room!: RoomEntity | null;

  @Column({
    type: 'enum',
    enum: ReservationSource,
    default: ReservationSource.DIRECT,
  })
  source!: ReservationSource;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.CONFIRMED,
  })
  status!: ReservationStatus;

  @Column({
    type: 'enum',
    enum: ReservationPaymentStatus,
    name: 'payment_status',
    default: ReservationPaymentStatus.PAYMENT_DUE,
  })
  paymentStatus!: ReservationPaymentStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'text', name: 'special_requests', nullable: true })
  specialRequests!: string | null;

  @Column({ type: 'boolean', name: 'payment_reviewed', default: false })
  paymentReviewed?: boolean;

  @Column({ type: 'varchar', length: 80, name: 'payment_method', nullable: true })
  paymentMethod?: string | null;

  @Column({ type: 'text', name: 'payment_review_notes', nullable: true })
  paymentReviewNotes?: string | null;

  @Column({ type: 'boolean', name: 'is_foreign_national', default: false })
  isForeignNational?: boolean;

  @Column({ type: 'varchar', length: 64, name: 'passport_number_masked', nullable: true })
  passportNumberMasked?: string | null;

  @Column({ type: 'varchar', length: 120, name: 'passport_issue_place', nullable: true })
  passportIssuePlace?: string | null;

  @Column({ type: 'date', name: 'passport_issue_date', nullable: true })
  passportIssueDate?: string | null;

  @Column({ type: 'date', name: 'passport_expiry_date', nullable: true })
  passportExpiryDate?: string | null;

  @Column({ type: 'varchar', length: 64, name: 'visa_number_masked', nullable: true })
  visaNumberMasked?: string | null;

  @Column({ type: 'varchar', length: 80, name: 'visa_type', nullable: true })
  visaType?: string | null;

  @Column({ type: 'date', name: 'visa_issue_date', nullable: true })
  visaIssueDate?: string | null;

  @Column({ type: 'date', name: 'visa_expiry_date', nullable: true })
  visaExpiryDate?: string | null;

  @Column({ type: 'boolean', name: 'c_form_required', default: false })
  cFormRequired?: boolean;

  @Column({
    type: 'enum',
    enum: CFormStatus,
    name: 'c_form_status',
    default: CFormStatus.NOT_REQUIRED,
  })
  cFormStatus?: CFormStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
