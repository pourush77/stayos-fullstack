import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../audit/infrastructure/audit-event.entity';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { PropertiesModule } from '../properties/properties.module';
import { RoomTypeEntity } from '../room-types/infrastructure/room-type.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { CheckInCaptureController } from './check-in-capture/check-in-capture.controller';
import { DocumentStorageService } from './check-in-capture/document-storage.service';
import { GuestDocumentEntity } from './check-in-capture/guest-document.entity';
import { MobileCaptureController } from './check-in-capture/mobile-capture.controller';
import { MobileCaptureService } from './check-in-capture/mobile-capture.service';
import { MobileCaptureSessionEntity } from './check-in-capture/mobile-capture-session.entity';
import { GuestIdentityDocumentEntity } from './infrastructure/guest-identity-document.entity';
import { ReservationEntity } from './infrastructure/reservation.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { CheckInService } from './services/check-in.service';
import { ReservationWorkflowService } from './services/reservation-workflow.service';
import { StaysController } from './stays.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReservationEntity,
      GuestEntity,
      RoomTypeEntity,
      RoomEntity,
      GuestIdentityDocumentEntity,
      MobileCaptureSessionEntity,
      GuestDocumentEntity,
      AuditEventEntity,
      ActivityEventEntity,
    ]),
    PropertiesModule,
  ],
  controllers: [
    ReservationsController,
    StaysController,
    CheckInCaptureController,
    MobileCaptureController,
  ],
  providers: [
    ReservationsService,
    ReservationWorkflowService,
    CheckInService,
    MobileCaptureService,
    DocumentStorageService,
  ],
})
export class ReservationsModule {}
