import { DataSource, Repository } from 'typeorm';
import { FolioEntity } from '../../billing/infrastructure/folio.entity';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { NotificationDeliveryEntity } from '../infrastructure/notification-delivery.entity';
import { NotificationService } from '../notification.service';
import { BookingConfirmationEmailService } from './booking-confirmation-email.service';
import { EmailTemplateService } from './email-template.service';

describe('BookingConfirmationEmailService', () => {
  const reservationsRepository = {
    findOne: jest.fn(),
  } as unknown as Repository<ReservationEntity>;

  const propertiesRepository = {
    findOne: jest.fn(),
  } as unknown as Repository<PropertyEntity>;

  const notificationService = {
    isEmailConfigured: jest.fn(() => true),
    queueEmail: jest.fn(),
    queueEmailResend: jest.fn(),
    sendEmail: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;

  const folioRepository = {
    findOne: jest.fn(),
  };

  const dataSource = {
    query: jest.fn(),
    getRepository: jest.fn(),
  } as unknown as DataSource;

  const emailTemplateService = new EmailTemplateService();

  let service: BookingConfirmationEmailService;

  const reservation = {
    id: 'reservation-1',
    propertyId: 'property-1',
    status: ReservationStatus.CONFIRMED,
    reservationCode: 'ST-1001',
    arrivalDate: '2026-08-20',
    departureDate: '2026-08-22',
    adults: 2,
    children: 1,
    ratePlanId: 'rate-plan-1',

    rateSnapshot: {
      pricingStatus: 'PRICED',
      ratePlan: {
        id: 'rate-plan-1',
        code: 'BAR',
      },
      mealPlan: 'BREAKFAST',
      refundable: true,
    },

    guest: {
      displayName: 'Priya Verma',
      email: 'priya@example.com',
    },

    roomType: {
      name: 'Deluxe',
    },
  };

  const property = {
    id: 'property-1',
    name: 'Example Hotel',
    email: 'frontdesk@example.com',
    phone: '+91 9999999999',
    logoUrl: 'https://example.com/logo.png',

    addressLine1: 'MG Road',
    addressLine2: null,
    city: 'Indore',
    state: 'Madhya Pradesh',
    postalCode: '452001',

    checkInTime: '14:00:00',
    checkOutTime: '12:00:00',

    currency: 'INR',

    // Default for normal email tests:
    // this property has guest emails enabled.
    emailNotificationsEnabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (notificationService.isEmailConfigured as jest.Mock).mockReturnValue(true);

    (notificationService.sendEmail as jest.Mock).mockResolvedValue(undefined);

    (dataSource.getRepository as jest.Mock).mockReturnValue(folioRepository);

    (dataSource.query as jest.Mock).mockResolvedValue([
      {
        name: 'Best Available Rate',
      },
    ]);

    (folioRepository.findOne as jest.Mock).mockResolvedValue(null);

    service = new BookingConfirmationEmailService(
      reservationsRepository,
      propertiesRepository,
      notificationService,
      emailTemplateService,
      dataSource,
    );
  });

  it('uses real rate-snapshot fields in a confirmed reservation email', async () => {
    (reservationsRepository.findOne as jest.Mock).mockResolvedValue(reservation);

    (propertiesRepository.findOne as jest.Mock).mockResolvedValue(property);

    (notificationService.queueEmail as jest.Mock).mockResolvedValue({
      id: 'delivery-1',
    } as NotificationDeliveryEntity);

    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: true,
      deliveryId: 'delivery-1',
    });

    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('FROM rate_plans'), [
      'rate-plan-1',
      'property-1',
    ]);

    await Promise.resolve();

    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        subject: expect.stringContaining('Your booking at Example Hotel is confirmed'),
        html: expect.stringContaining('Breakfast included'),
      }),
    );
  });

  it('uses an existing folio for subtotal, tax, total, paid and balance', async () => {
    (reservationsRepository.findOne as jest.Mock).mockResolvedValue(reservation);

    (propertiesRepository.findOne as jest.Mock).mockResolvedValue(property);

    (notificationService.queueEmail as jest.Mock).mockResolvedValue({
      id: 'delivery-1',
    } as NotificationDeliveryEntity);

    (folioRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'folio-1',
      propertyId: 'property-1',
      reservationId: 'reservation-1',
      currency: 'INR',

      charges: [
        {
          amount: '10000.00',
          taxAmount: '1200.00',
          taxSnapshot: null,
        },
      ],

      payments: [
        {
          amount: '2000.00',
        },
      ],
    } as unknown as FolioEntity);

    await service.queueAutomatic('property-1', 'reservation-1');

    await Promise.resolve();

    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        html: expect.stringContaining('₹11,200.00'),
      }),
    );

    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        html: expect.stringContaining('₹9,200.00'),
      }),
    );
  });

  it('does not create a folio when none exists', async () => {
    (reservationsRepository.findOne as jest.Mock).mockResolvedValue(reservation);

    (propertiesRepository.findOne as jest.Mock).mockResolvedValue(property);

    (notificationService.queueEmail as jest.Mock).mockResolvedValue({
      id: 'delivery-1',
    } as NotificationDeliveryEntity);

    (folioRepository.findOne as jest.Mock).mockResolvedValue(null);

    await service.queueAutomatic('property-1', 'reservation-1');

    expect(dataSource.getRepository).toHaveBeenCalledWith(FolioEntity);

    expect(folioRepository.findOne).toHaveBeenCalledTimes(1);
  });

  it('still queues if rate-plan display-name lookup fails', async () => {
    (reservationsRepository.findOne as jest.Mock).mockResolvedValue(reservation);

    (propertiesRepository.findOne as jest.Mock).mockResolvedValue(property);

    (notificationService.queueEmail as jest.Mock).mockResolvedValue({
      id: 'delivery-1',
    } as NotificationDeliveryEntity);

    (dataSource.query as jest.Mock).mockRejectedValue(new Error('lookup unavailable'));

    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: true,
      deliveryId: 'delivery-1',
    });
  });

  it('does not queue email when property email notifications are disabled', async () => {
    (reservationsRepository.findOne as jest.Mock).mockResolvedValue(reservation);

    (propertiesRepository.findOne as jest.Mock).mockResolvedValue({
      ...property,
      emailNotificationsEnabled: false,
    });

    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: false,
      reason: 'PROPERTY_EMAIL_DISABLED',
    });

    expect(notificationService.queueEmail).not.toHaveBeenCalled();

    expect(notificationService.queueEmailResend).not.toHaveBeenCalled();

    expect(notificationService.sendEmail).not.toHaveBeenCalled();

    expect(folioRepository.findOne).not.toHaveBeenCalled();

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('does nothing when the guest has no email', async () => {
    (reservationsRepository.findOne as jest.Mock).mockResolvedValue({
      ...reservation,

      guest: {
        displayName: 'Priya Verma',
        email: null,
      },
    });

    (propertiesRepository.findOne as jest.Mock).mockResolvedValue(property);

    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: false,
      reason: 'NO_GUEST_EMAIL',
    });

    expect(notificationService.queueEmail).not.toHaveBeenCalled();

    expect(notificationService.sendEmail).not.toHaveBeenCalled();
  });

  it('does nothing when email integration is disabled', async () => {
    (notificationService.isEmailConfigured as jest.Mock).mockReturnValue(false);

    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: false,
      reason: 'EMAIL_DISABLED',
    });

    expect(reservationsRepository.findOne).not.toHaveBeenCalled();

    expect(propertiesRepository.findOne).not.toHaveBeenCalled();

    expect(notificationService.queueEmail).not.toHaveBeenCalled();

    expect(notificationService.sendEmail).not.toHaveBeenCalled();
  });

  it('creates a fresh delivery for explicit resend', async () => {
    (reservationsRepository.findOne as jest.Mock).mockResolvedValue(reservation);

    (propertiesRepository.findOne as jest.Mock).mockResolvedValue(property);

    (notificationService.queueEmailResend as jest.Mock).mockResolvedValue({
      id: 'delivery-resend-1',
    } as NotificationDeliveryEntity);

    await expect(service.resend('property-1', 'reservation-1')).resolves.toEqual({
      queued: true,
      deliveryId: 'delivery-resend-1',
    });

    expect(notificationService.queueEmailResend).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: 'property-1',
        entityId: 'reservation-1',
        recipient: 'priya@example.com',
      }),
    );
  });
});
