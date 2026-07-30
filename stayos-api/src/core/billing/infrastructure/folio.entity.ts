import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { FolioStatus } from '../domain/folio-status.enum';
import { FolioChargeEntity } from './folio-charge.entity';
import { FolioPaymentEntity } from './folio-payment.entity';

@Entity({ name: 'folios' })
@Index('UQ_folios_reservation_id', ['reservationId'], { unique: true })
@Index('IDX_folios_property_id', ['propertyId'])
@Index('IDX_folios_guest_id', ['guestId'])
@Index('IDX_folios_status', ['status'])
export class FolioEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'uuid', name: 'reservation_id' })
  reservationId!: string;

  @ManyToOne(() => ReservationEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reservation_id' })
  reservation!: ReservationEntity;

  @Column({ type: 'uuid', name: 'guest_id' })
  guestId!: string;

  @ManyToOne(() => GuestEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'guest_id' })
  guest!: GuestEntity;

  @Column({ type: 'varchar', length: 32, name: 'folio_number' })
  folioNumber!: string;

  @Column({
    type: 'enum',
    enum: FolioStatus,
    default: FolioStatus.OPEN,
  })
  status!: FolioStatus;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ type: 'timestamptz', name: 'settled_at', nullable: true })
  settledAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => FolioChargeEntity, (charge) => charge.folio, { cascade: false })
  charges!: FolioChargeEntity[];

  @OneToMany(() => FolioPaymentEntity, (payment) => payment.folio, { cascade: false })
  payments!: FolioPaymentEntity[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
