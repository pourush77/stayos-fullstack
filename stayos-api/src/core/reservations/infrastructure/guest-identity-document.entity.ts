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
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { IdentityDocumentType } from '../domain/identity-document-type.enum';
import { ReservationEntity } from './reservation.entity';

@Entity({ name: 'guest_identity_documents' })
@Index('IDX_guest_identity_documents_property_id', ['propertyId'])
@Index('IDX_guest_identity_documents_guest_id', ['guestId'])
@Index('IDX_guest_identity_documents_reservation_id', ['reservationId'])
export class GuestIdentityDocumentEntity {
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

  @Column({ type: 'uuid', name: 'reservation_id' })
  reservationId!: string;

  @ManyToOne(() => ReservationEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reservation_id' })
  reservation!: ReservationEntity;

  @Column({ type: 'enum', enum: IdentityDocumentType, name: 'id_type' })
  idType!: IdentityDocumentType;

  @Column({ type: 'varchar', length: 64, name: 'id_number_masked' })
  idNumberMasked!: string;

  @Column({ type: 'text', name: 'document_front_url', nullable: true })
  documentFrontUrl!: string | null;

  @Column({ type: 'text', name: 'document_back_url', nullable: true })
  documentBackUrl!: string | null;

  @Column({ type: 'boolean', default: false })
  verified!: boolean;

  @Column({ type: 'uuid', name: 'verified_by_user_id', nullable: true })
  verifiedByUserId!: string | null;

  @Column({ type: 'timestamptz', name: 'verified_at', nullable: true })
  verifiedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
