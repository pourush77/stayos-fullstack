import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceStatus } from '../../billing/domain/invoice-status.enum';
import { InvoiceType } from '../../billing/domain/invoice-type.enum';
import { InvoiceEntity } from '../../billing/infrastructure/invoice.entity';
import { ReceiptPdfService } from '../../billing/receipt-pdf.service';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { NotificationType } from '../domain/notification-type.enum';
import { NotificationService } from '../notification.service';
import { EmailTemplateService } from './email-template.service';

export interface CheckoutInvoiceEmailQueueResult {
  queued: boolean;
  reason?:
    | 'EMAIL_DISABLED'
    | 'PROPERTY_EMAIL_DISABLED'
    | 'NO_GUEST_EMAIL'
    | 'NOT_CHECKED_OUT'
    | 'NO_FINALIZED_INVOICE';
  deliveryId?: string;
}

@Injectable()
export class CheckoutInvoiceEmailService {
  private readonly logger = new Logger(CheckoutInvoiceEmailService.name);

  constructor(
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(PropertyEntity)
    private readonly propertiesRepository: Repository<PropertyEntity>,
    @InjectRepository(InvoiceEntity)
    private readonly invoicesRepository: Repository<InvoiceEntity>,
    private readonly notificationService: NotificationService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly receiptPdfService: ReceiptPdfService,
  ) {}

  async queueAutomatic(
    propertyId: string,
    reservationId: string,
  ): Promise<CheckoutInvoiceEmailQueueResult> {
    return this.queue(propertyId, reservationId, false);
  }

  async resend(
    propertyId: string,
    reservationId: string,
  ): Promise<CheckoutInvoiceEmailQueueResult> {
    return this.queue(propertyId, reservationId, true);
  }

  private async queue(
    propertyId: string,
    reservationId: string,
    resend: boolean,
  ): Promise<CheckoutInvoiceEmailQueueResult> {
    if (!this.notificationService.isEmailConfigured()) {
      return { queued: false, reason: 'EMAIL_DISABLED' };
    }

    const [reservation, property] = await Promise.all([
      this.reservationsRepository.findOne({
        where: { id: reservationId, propertyId },
        relations: { guest: true },
      }),
      this.propertiesRepository.findOne({
        where: { id: propertyId },
      }),
    ]);

    if (!reservation || !property) {
      throw new NotFoundException('Reservation or property was not found');
    }

    if (!property.emailNotificationsEnabled) {
      return {
        queued: false,
        reason: 'PROPERTY_EMAIL_DISABLED',
      };
    }

    if (reservation.status !== ReservationStatus.CHECKED_OUT) {
      return {
        queued: false,
        reason: 'NOT_CHECKED_OUT',
      };
    }

    const email = reservation.guest?.email?.trim();
    if (!email) {
      return {
        queued: false,
        reason: 'NO_GUEST_EMAIL',
      };
    }

    const invoice = await this.invoicesRepository.findOne({
      where: {
        propertyId,
        reservationId: reservation.id,
        type: InvoiceType.TAX_INVOICE,
        status: InvoiceStatus.FINALIZED,
      },
      order: {
        issuedAt: 'DESC',
        createdAt: 'DESC',
      },
    });

    if (!invoice || !invoice.invoiceNumber) {
      return {
        queued: false,
        reason: 'NO_FINALIZED_INVOICE',
      };
    }

    /*
     * Queue the notification before doing provider delivery. Automatic sends
     * use the stable dedupe key; explicit resends intentionally create a fresh
     * delivery row.
     */
    const delivery = resend
      ? await this.notificationService.queueEmailResend({
          propertyId,
          notificationType: NotificationType.CHECKOUT_INVOICE,
          entityType: 'RESERVATION',
          entityId: reservation.id,
          recipient: email,
        })
      : await this.notificationService.queueEmail({
          propertyId,
          notificationType: NotificationType.CHECKOUT_INVOICE,
          entityType: 'RESERVATION',
          entityId: reservation.id,
          recipient: email,
        });

    /*
     * The PDF is rendered only from the immutable finalized InvoiceEntity
     * snapshot. This keeps later resends reproducible even if live folio,
     * guest or property data changes.
     */
    const pdf = await this.receiptPdfService.generateTaxInvoice(invoice);

    const template = this.emailTemplateService.checkoutInvoice({
      property: {
        name: property.name,
        email: property.email,
        phone: property.phone,
        logoUrl: property.logoUrl,
      },
      guestName: reservation.guest?.displayName || invoice.buyer?.name || 'Guest',
      reservationCode: reservation.reservationCode,
      invoiceNumber: invoice.invoiceNumber,
      arrivalDate: reservation.arrivalDate,
      departureDate: reservation.departureDate,
      totalPaid: invoice.totals?.paid ?? invoice.grandTotal,
      currency: invoice.currency,
    });

    const filename = `TaxInvoice-${this.safeFilename(invoice.invoiceNumber)}.pdf`;

    /*
     * Match booking-confirmation behaviour: provider delivery is deliberately
     * detached from the caller. A Resend/provider failure is persisted on the
     * delivery row by NotificationService and must never turn a successful
     * hotel checkout into an API failure.
     */
    void this.notificationService
      .sendEmail(delivery.id, {
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments: [
          {
            filename,
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      })
      .catch((error) => {
        this.logger.error({
          event: 'CHECKOUT_INVOICE_EMAIL_DISPATCH_FAILED',
          propertyId,
          reservationId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          deliveryId: delivery.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return {
      queued: true,
      deliveryId: delivery.id,
    };
  }

  private safeFilename(value: string): string {
    const cleaned = value
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return cleaned || 'invoice';
  }
}
