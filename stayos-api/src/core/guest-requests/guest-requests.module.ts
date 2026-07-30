import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { EmployeeEntity } from '../employees/infrastructure/employee.entity';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { GuestRequestsController } from './guest-requests.controller';
import { GuestRequestsService } from './guest-requests.service';
import { GuestRequestEntity } from './infrastructure/guest-request.entity';
import { GuestRequestNoteEntity } from './infrastructure/guest-request-note.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GuestRequestEntity,
      GuestRequestNoteEntity,
      ReservationEntity,
      GuestEntity,
      RoomEntity,
      EmployeeEntity,
      ActivityEventEntity,
    ]),
  ],
  controllers: [GuestRequestsController],
  providers: [GuestRequestsService],
})
export class GuestRequestsModule {}
