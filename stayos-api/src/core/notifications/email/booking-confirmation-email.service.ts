import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { calculateTotals } from '../../billing/billing.mapper';
import { FolioEntity } from '../../billing/infrastructure/folio.entity';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { NotificationType } from '../domain/notification-type.enum';
import { NotificationService } from '../notification.service';
import { EmailTemplateService } from './email-template.service';

export interface BookingConfirmationEmailQueueResult {
  queued: boolean;
  reason?: 'EMAIL_DISABLED' | 'PROPERTY_EMAIL_DISABLED' | 'NO_GUEST_EMAIL' | 'NOT_CONFIRMED';
  deliveryId?: string;
}

type CommercialSnapshot = {
  pricingStatus?: string;
  mealPlan?: string;
  refundable?: boolean;
  ratePlan?: { id?: string; code?: string };
};

@Injectable()
export class BookingConfirmationEmailService {
  private readonly logger = new Logger(BookingConfirmationEmailService.name);

  constructor(
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(PropertyEntity)
    private readonly propertiesRepository: Repository<PropertyEntity>,
    private readonly notificationService: NotificationService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly dataSource: DataSource,
  ) {}

  async queueAutomatic(propertyId: string, reservationId: string) {
    return this.queue(propertyId, reservationId, false);
  }

  async resend(propertyId: string, reservationId: string) {
    return this.queue(propertyId, reservationId, true);
  }

  private async queue(
    propertyId: string,
    reservationId: string,
    resend: boolean,
  ): Promise<BookingConfirmationEmailQueueResult> {
    if (!this.notificationService.isEmailConfigured()) {
      return { queued: false, reason: 'EMAIL_DISABLED' };
    }

    const [reservation, property] = await Promise.all([
      this.reservationsRepository.findOne({
        where: { id: reservationId, propertyId },
        relations: { guest: true, roomType: true },
      }),
      this.propertiesRepository.findOne({ where: { id: propertyId } }),
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

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      return { queued: false, reason: 'NOT_CONFIRMED' };
    }

    const email = reservation.guest?.email?.trim();
    if (!email) {
      return { queued: false, reason: 'NO_GUEST_EMAIL' };
    }

    const delivery = resend
      ? await this.notificationService.queueEmailResend({
          propertyId,
          notificationType: NotificationType.BOOKING_CONFIRMATION,
          entityType: 'RESERVATION',
          entityId: reservation.id,
          recipient: email,
        })
      : await this.notificationService.queueEmail({
          propertyId,
          notificationType: NotificationType.BOOKING_CONFIRMATION,
          entityType: 'RESERVATION',
          entityId: reservation.id,
          recipient: email,
        });

    const snapshot = this.readCommercialSnapshot(reservation.rateSnapshot);

    const [ratePlanName, billing] = await Promise.all([
      this.findRatePlanName(propertyId, reservation.ratePlanId ?? snapshot?.ratePlan?.id ?? null),
      this.findBillingSummary(propertyId, reservation.id),
    ]);

    const template = this.emailTemplateService.bookingConfirmation({
      property: {
        name: property.name,
        email: property.email,
        phone: property.phone,
        address: [
          property.addressLine1,
          property.addressLine2,
          property.city,
          property.state,
          property.postalCode,
        ]
          .filter(Boolean)
          .join(', '),
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
        logoUrl: property.logoUrl,
      },
      guestName: reservation.guest.displayName,
      reservationCode: reservation.reservationCode,
      arrivalDate: reservation.arrivalDate,
      departureDate: reservation.departureDate,
      roomType: reservation.roomType?.name ?? null,
      adults: reservation.adults,
      children: reservation.children,
      ratePlanName,
      mealPlan: snapshot?.mealPlan ?? null,
      refundable: typeof snapshot?.refundable === 'boolean' ? snapshot.refundable : null,
      roomAmount: billing?.subtotal ?? null,
      taxAmount: billing?.tax ?? null,
      totalAmount: billing?.total ?? null,
      paidAmount: billing?.paid ?? null,
      balanceAmount: billing?.balance ?? null,
      currency: billing?.currency ?? property.currency,
    });

    void this.notificationService
      .sendEmail(delivery.id, {
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
      .catch((error) => {
        this.logger.error({
          event: 'BOOKING_CONFIRMATION_EMAIL_DISPATCH_FAILED',
          propertyId,
          reservationId,
          deliveryId: delivery.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return { queued: true, deliveryId: delivery.id };
  }

  private readCommercialSnapshot(value: Record<string, unknown> | null): CommercialSnapshot | null {
    if (!value || typeof value !== 'object') return null;
    const snapshot = value as CommercialSnapshot;
    if (snapshot.pricingStatus && snapshot.pricingStatus !== 'PRICED') {
      return null;
    }
    return snapshot;
  }

  private async findRatePlanName(
    propertyId: string,
    ratePlanId: string | null,
  ): Promise<string | null> {
    if (!ratePlanId) return null;

    try {
      const rows = (await this.dataSource.query(
        `SELECT name
           FROM rate_plans
          WHERE id = $1 AND property_id = $2
          LIMIT 1`,
        [ratePlanId, propertyId],
      )) as Array<{ name: string }>;

      return rows[0]?.name?.trim() || null;
    } catch (error) {
      this.logger.warn({
        event: 'BOOKING_CONFIRMATION_RATE_PLAN_LOOKUP_FAILED',
        propertyId,
        ratePlanId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async findBillingSummary(
    propertyId: string,
    reservationId: string,
  ): Promise<{
    subtotal: string;
    tax: string;
    total: string;
    paid: string;
    balance: string;
    currency: string;
  } | null> {
    try {
      const folio = await this.dataSource.getRepository(FolioEntity).findOne({
        where: { propertyId, reservationId },
        relations: { charges: true, payments: true },
      });

      if (!folio) return null;

      const totals = calculateTotals(folio.charges ?? [], folio.payments ?? []);

      return {
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        paid: totals.paid,
        balance: totals.balance,
        currency: folio.currency,
      };
    } catch (error) {
      this.logger.warn({
        event: 'BOOKING_CONFIRMATION_FOLIO_LOOKUP_FAILED',
        propertyId,
        reservationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
