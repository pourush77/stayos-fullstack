import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from '../properties/properties.module';
import { RatesModule } from '../rates/rates.module';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { ReservationRateSnapshotEntity } from '../reservations/infrastructure/reservation-rate-snapshot.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { RazorpayService } from './razorpay.service';
import { ReceiptPdfService } from './receipt-pdf.service';
import { FolioChargeEntity } from './infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from './infrastructure/folio-payment.entity';
import { FolioEntity } from './infrastructure/folio.entity';
import { InvoiceEntity } from './infrastructure/invoice.entity';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { PropertyBillingConfigEntity } from '../billing-config/infrastructure/property-billing-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FolioEntity,
      FolioChargeEntity,
      FolioPaymentEntity,
      ReservationEntity,
      ReservationRateSnapshotEntity,
      InvoiceEntity,
      PropertyBillingConfigEntity,
    ]),
    PropertiesModule,
    RatesModule,
  ],
  controllers: [BillingController, InvoiceController],
  providers: [BillingService, RazorpayService, ReceiptPdfService, InvoiceService],
  exports: [BillingService, InvoiceService],
})
export class BillingModule {}
