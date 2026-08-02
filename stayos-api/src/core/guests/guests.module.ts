import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from '../properties/properties.module';
import { FolioChargeEntity } from '../billing/infrastructure/folio-charge.entity';
import { FolioEntity } from '../billing/infrastructure/folio.entity';
import { FolioPaymentEntity } from '../billing/infrastructure/folio-payment.entity';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { GuestEntity } from './infrastructure/guest.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GuestEntity,
      ReservationEntity,
      FolioEntity,
      FolioChargeEntity,
      FolioPaymentEntity,
    ]),
    PropertiesModule,
  ],
  controllers: [GuestsController],
  providers: [GuestsService],
})
export class GuestsModule {}
