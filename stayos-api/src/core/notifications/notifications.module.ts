import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyEntity } from '../properties/infrastructure/property.entity';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { BookingConfirmationEmailService } from './email/booking-confirmation-email.service';
import { EMAIL_PROVIDER } from './email/email-provider.interface';
import { EmailTemplateService } from './email/email-template.service';
import { ResendEmailProvider } from './email/resend-email.provider';
import { NotificationDeliveryEntity } from './infrastructure/notification-delivery.entity';
import { NotificationService } from './notification.service';
import { InvoiceEntity } from '../billing/infrastructure/invoice.entity';
import { ReceiptPdfService } from '../billing/receipt-pdf.service';
import { CheckoutInvoiceEmailService } from './email/checkout-invoice-email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationDeliveryEntity,
      ReservationEntity,
      PropertyEntity,
      InvoiceEntity,
    ]),
  ],
  providers: [
    NotificationService,
    EmailTemplateService,
    BookingConfirmationEmailService,
    ResendEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useExisting: ResendEmailProvider,
    },
    CheckoutInvoiceEmailService,
    ReceiptPdfService,
  ],
  exports: [
    NotificationService,
    EmailTemplateService,
    BookingConfirmationEmailService,
    CheckoutInvoiceEmailService,
  ],
})
export class NotificationsModule {}
