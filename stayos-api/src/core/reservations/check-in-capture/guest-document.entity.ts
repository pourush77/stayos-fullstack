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
import { ReservationEntity } from '../infrastructure/reservation.entity';

export type GuestDocumentSide = 'ID_FRONT' | 'ID_BACK';

@Entity({ name: 'guest_documents' })
@Index('IDX_guest_documents_property_id', ['propertyId'])
@Index('IDX_guest_documents_reservation_id', ['reservationId'])
@Index('IDX_guest_documents_reservation_side', ['reservationId', 'side'], { unique: true })
export class GuestDocumentEntity {
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

  @Column({ type: 'varchar', length: 48, name: 'document_kind' })
  documentKind!: string;

  @Column({ type: 'varchar', length: 16 })
  side!: GuestDocumentSide;

  @Column({ type: 'varchar', length: 160, name: 'original_filename' })
  originalFilename!: string;

  @Column({ type: 'varchar', length: 80, name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'integer', name: 'size_bytes' })
  sizeBytes!: number;

  @Column({ type: 'text', name: 'storage_path' })
  storagePath!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
