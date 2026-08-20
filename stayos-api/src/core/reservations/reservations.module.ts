import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../audit/infrastructure/audit-event.entity';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { PropertiesModule } from '../properties/properties.module';
import { PoliciesModule } from '../policies/policies.module';
import { RatesModule } from '../rates/rates.module';
import { RoomTypeEntity } from '../room-types/infrastructure/room-type.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { BillingModule } from '../billing/billing.module';
import { CheckInCaptureController } from './check-in-capture/check-in-capture.controller';
import { DocumentStorageService } from './check-in-capture/document-storage.service';
import { GuestDocumentEntity } from './check-in-capture/guest-document.entity';
import { MobileCaptureController } from './check-in-capture/mobile-capture.controller';
import { MobileCaptureService } from './check-in-capture/mobile-capture.service';
import { MobileCaptureSessionEntity } from './check-in-capture/mobile-capture-session.entity';
import { GuestIdentityDocumentEntity } from './infrastructure/guest-identity-document.entity';
import { ReservationEntity } from './infrastructure/reservation.entity';
import { ReservationRateSnapshotEntity } from './infrastructure/reservation-rate-snapshot.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { CheckInService } from './services/check-in.service';
import { ReservationWorkflowService } from './services/reservation-workflow.service';
import { ReservationPricingService } from './services/reservation-pricing.service';
import { ReservationQuoteService } from './services/reservation-quote.service';
import { ReservationRateSnapshotService } from './services/reservation-rate-snapshot.service';
import { StaysController } from './stays.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReservationEntity,
      ReservationRateSnapshotEntity,
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
    RatesModule,
    PoliciesModule,
    BillingModule,
    InventoryModule,
    NotificationsModule,
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
    ReservationPricingService,
    ReservationQuoteService,
    ReservationRateSnapshotService,
    CheckInService,
    MobileCaptureService,
    DocumentStorageService,
  ],
})
export class ReservationsModule {}
