import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../audit/infrastructure/audit-event.entity';
import { PropertiesModule } from '../properties/properties.module';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomTypeEntity } from '../room-types/infrastructure/room-type.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { OperationsController } from './controllers/operations.controller';
import { GroupBookingRoomBlockEntity } from './infrastructure/group-booking-room-block.entity';
import { GroupBookingRoomAssignmentEntity } from './infrastructure/group-booking-room-assignment.entity';
import { GroupBookingRoomingListEntity } from './infrastructure/group-booking-rooming-list.entity';
import { GroupBookingEntity } from './infrastructure/group-booking.entity';
import { GroupMasterFolioEntity } from './infrastructure/group-master-folio.entity';
import { GroupStayEntity } from './infrastructure/group-stay.entity';
import { ActivityFeedService } from './services/activity-feed.service';
import { GroupBookingService } from './services/group-booking.service';
import { GroupRoomMixService } from './services/group-room-mix.service';
import { NeedsAttentionService } from './services/needs-attention.service';
import { RoomAvailabilityService } from './services/room-availability.service';
import { RoomBoardService } from './services/room-board.service';
import { RoomDetailsService } from './services/room-details.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoomEntity,
      RoomTypeEntity,
      ReservationEntity,
      GroupBookingEntity,
      GroupBookingRoomBlockEntity,
      GroupBookingRoomingListEntity,
      GroupBookingRoomAssignmentEntity,
      GroupStayEntity,
      GroupMasterFolioEntity,
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
    GroupBookingService,
    GroupRoomMixService,
    NeedsAttentionService,
    ActivityFeedService,
  ],
})
export class OperationsModule {}
