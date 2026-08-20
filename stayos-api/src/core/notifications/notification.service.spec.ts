import { Repository } from 'typeorm';
import { NotificationChannel } from './domain/notification-channel.enum';
import { NotificationStatus } from './domain/notification-status.enum';
import { NotificationType } from './domain/notification-type.enum';
import { EmailProvider } from './email/email-provider.interface';
import { NotificationDeliveryEntity } from './infrastructure/notification-delivery.entity';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  const repository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as Repository<NotificationDeliveryEntity>;

  const emailProvider: EmailProvider = {
    isConfigured: jest.fn(() => true),
    send: jest.fn(),
  };

  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService(repository, emailProvider);
  });

  it('queues one property-scoped email notification', async () => {
    const created = {
      id: 'delivery-1',
      propertyId: 'property-1',
      channel: NotificationChannel.EMAIL,
      notificationType: NotificationType.BOOKING_CONFIRMATION,
      entityType: 'RESERVATION',
      entityId: 'reservation-1',
      recipient: 'guest@example.com',
      status: NotificationStatus.PENDING,
      dedupeKey: 'property-1:BOOKING_CONFIRMATION:reservation-1:EMAIL',
    } as NotificationDeliveryEntity;

    (repository.findOne as jest.Mock).mockResolvedValue(null);
    (repository.create as jest.Mock).mockReturnValue(created);
    (repository.save as jest.Mock).mockResolvedValue(created);

    const result = await service.queueEmail({
      propertyId: 'property-1',
      notificationType: NotificationType.BOOKING_CONFIRMATION,
      entityType: 'RESERVATION',
      entityId: 'reservation-1',
      recipient: ' Guest@Example.COM ',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: 'property-1',
        recipient: 'guest@example.com',
        status: NotificationStatus.PENDING,
        dedupeKey: 'property-1:BOOKING_CONFIRMATION:reservation-1:EMAIL',
      }),
    );
    expect(result).toBe(created);
  });

  it('returns the existing automatic notification for the same dedupe key', async () => {
    const existing = {
      id: 'delivery-1',
      dedupeKey: 'property-1:BOOKING_CONFIRMATION:reservation-1:EMAIL',
    } as NotificationDeliveryEntity;

    (repository.findOne as jest.Mock).mockResolvedValue(existing);

    const result = await service.queueEmail({
      propertyId: 'property-1',
      notificationType: NotificationType.BOOKING_CONFIRMATION,
      entityType: 'RESERVATION',
      entityId: 'reservation-1',
      recipient: 'guest@example.com',
    });

    expect(result).toBe(existing);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('marks a successful email as SENT with the provider message id', async () => {
    const delivery = {
      id: 'delivery-1',
      channel: NotificationChannel.EMAIL,
      recipient: 'guest@example.com',
      status: NotificationStatus.PENDING,
      attemptCount: 0,
      provider: null,
      providerMessageId: null,
      lastError: null,
      nextAttemptAt: null,
      sentAt: null,
    } as NotificationDeliveryEntity;

    (repository.findOne as jest.Mock).mockResolvedValue(delivery);
    (emailProvider.send as jest.Mock).mockResolvedValue({
      providerMessageId: 'email-123',
    });
    (repository.save as jest.Mock).mockImplementation(async (value) => value);

    const result = await service.sendEmail('delivery-1', {
      subject: 'Booking confirmed',
      text: 'Confirmed',
    });

    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guest@example.com',
        subject: 'Booking confirmed',
      }),
    );
    expect(result.status).toBe(NotificationStatus.SENT);
    expect(result.providerMessageId).toBe('email-123');
    expect(result.attemptCount).toBe(1);
  });

  it('marks provider failure as FAILED without throwing into the PMS flow', async () => {
    const delivery = {
      id: 'delivery-1',
      channel: NotificationChannel.EMAIL,
      recipient: 'guest@example.com',
      status: NotificationStatus.PENDING,
      attemptCount: 0,
      provider: null,
      providerMessageId: null,
      lastError: null,
      nextAttemptAt: null,
      sentAt: null,
    } as NotificationDeliveryEntity;

    (repository.findOne as jest.Mock).mockResolvedValue(delivery);
    (emailProvider.send as jest.Mock).mockRejectedValue(new Error('Provider timeout'));
    (repository.save as jest.Mock).mockImplementation(async (value) => value);

    const result = await service.sendEmail('delivery-1', {
      subject: 'Booking confirmed',
      text: 'Confirmed',
    });

    expect(result.status).toBe(NotificationStatus.FAILED);
    expect(result.lastError).toBe('Provider timeout');
    expect(result.attemptCount).toBe(1);
  });

  it('does not send an already-sent delivery again automatically', async () => {
    const delivery = {
      id: 'delivery-1',
      channel: NotificationChannel.EMAIL,
      recipient: 'guest@example.com',
      status: NotificationStatus.SENT,
      attemptCount: 1,
    } as NotificationDeliveryEntity;

    (repository.findOne as jest.Mock).mockResolvedValue(delivery);

    const result = await service.sendEmail('delivery-1', {
      subject: 'Booking confirmed',
      text: 'Confirmed',
    });

    expect(result).toBe(delivery);
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('creates a fresh delivery for an intentional resend', async () => {
    const created = {
      id: 'delivery-resend-1',
      propertyId: 'property-1',
      channel: NotificationChannel.EMAIL,
      notificationType: NotificationType.BOOKING_CONFIRMATION,
      entityType: 'RESERVATION',
      entityId: 'reservation-1',
      recipient: 'guest@example.com',
      status: NotificationStatus.PENDING,
    } as NotificationDeliveryEntity;

    (repository.create as jest.Mock).mockReturnValue(created);
    (repository.save as jest.Mock).mockResolvedValue(created);

    const result = await service.queueEmailResend({
      propertyId: 'property-1',
      notificationType: NotificationType.BOOKING_CONFIRMATION,
      entityType: 'RESERVATION',
      entityId: 'reservation-1',
      recipient: 'guest@example.com',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: 'property-1',
        entityId: 'reservation-1',
        recipient: 'guest@example.com',
        status: NotificationStatus.PENDING,
        dedupeKey: expect.stringContaining(
          'property-1:BOOKING_CONFIRMATION:reservation-1:EMAIL:resend:',
        ),
      }),
    );
    expect(result).toBe(created);
  });

  it('keeps automatic dedupe property-scoped', () => {
    expect(
      service.buildAutomaticDedupeKey({
        propertyId: 'property-a',
        notificationType: NotificationType.CHECKOUT_INVOICE,
        entityId: 'invoice-1',
        channel: NotificationChannel.EMAIL,
      }),
    ).not.toBe(
      service.buildAutomaticDedupeKey({
        propertyId: 'property-b',
        notificationType: NotificationType.CHECKOUT_INVOICE,
        entityId: 'invoice-1',
        channel: NotificationChannel.EMAIL,
      }),
    );
  });
});
