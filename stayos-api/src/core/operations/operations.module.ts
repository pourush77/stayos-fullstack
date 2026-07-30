import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../audit/infrastructure/audit-event.entity';
import { PropertiesModule } from '../properties/properties.module';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { OperationsController } from './controllers/operations.controller';
import { ActivityFeedService } from './services/activity-feed.service';
import { NeedsAttentionService } from './services/needs-attention.service';
import { RoomAvailabilityService } from './services/room-availability.service';
import { RoomBoardService } from './services/room-board.service';
import { RoomDetailsService } from './services/room-details.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoomEntity,
      ReservationEntity,
      ActivityEventEntity,
      AuditEventEntity,
    ]),
    PropertiesModule,
  ],
  controllers: [OperationsController],
  providers: [
    RoomBoardService,
    RoomDetailsService,
    RoomAvailabilityService,
    NeedsAttentionService,
    ActivityFeedService,
  ],
})
export class OperationsModule {}
