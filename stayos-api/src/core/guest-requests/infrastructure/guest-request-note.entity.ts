import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../auth/infrastructure/user.entity';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { GuestRequestEntity } from './guest-request.entity';

@Entity({ name: 'guest_request_notes' })
@Index('IDX_guest_request_notes_request_id', ['requestId'])
export class GuestRequestNoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'property_id' })
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property!: PropertyEntity;

  @Column({ type: 'uuid', name: 'request_id' })
  requestId!: string;

  @ManyToOne(() => GuestRequestEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request!: GuestRequestEntity;

  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor!: UserEntity | null;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
