import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from '../properties/properties.module';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { RazorpayService } from './razorpay.service';
import { FolioChargeEntity } from './infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from './infrastructure/folio-payment.entity';
import { FolioEntity } from './infrastructure/folio.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FolioEntity,
      FolioChargeEntity,
      FolioPaymentEntity,
      ReservationEntity,
    ]),
    PropertiesModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, RazorpayService],
  exports: [BillingService],
})
export class BillingModule {}
