import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FolioEntity } from '../billing/infrastructure/folio.entity';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { PropertiesModule } from '../properties/properties.module';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { GlobalSearchController } from './global-search.controller';
import { GlobalSearchService } from './global-search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GuestEntity, ReservationEntity, RoomEntity, FolioEntity]),
    PropertiesModule,
  ],
  controllers: [GlobalSearchController],
  providers: [GlobalSearchService],
})
export class GlobalSearchModule {}
