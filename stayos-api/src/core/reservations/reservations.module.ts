import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../audit/infrastructure/audit-event.entity';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { PropertiesModule } from '../properties/properties.module';
import { RoomTypeEntity } from '../room-types/infrastructure/room-type.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { GuestIdentityDocumentEntity } from './infrastructure/guest-identity-document.entity';
import { ReservationEntity } from './infrastructure/reservation.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { CheckInService } from './services/check-in.service';
import { ReservationWorkflowService } from './services/reservation-workflow.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReservationEntity,
      GuestEntity,
      RoomTypeEntity,
      RoomEntity,
      GuestIdentityDocumentEntity,
      AuditEventEntity,
      ActivityEventEntity,
    ]),
    PropertiesModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationWorkflowService, CheckInService],
})
export class ReservationsModule {}
