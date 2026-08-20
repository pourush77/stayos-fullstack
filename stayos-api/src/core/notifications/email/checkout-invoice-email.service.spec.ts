import { Repository } from 'typeorm';
import { InvoiceStatus } from '../../billing/domain/invoice-status.enum';
import { InvoiceType } from '../../billing/domain/invoice-type.enum';
import { InvoiceEntity } from '../../billing/infrastructure/invoice.entity';
import { ReceiptPdfService } from '../../billing/receipt-pdf.service';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { NotificationDeliveryEntity } from '../infrastructure/notification-delivery.entity';
import { NotificationService } from '../notification.service';
import { CheckoutInvoiceEmailService } from './checkout-invoice-email.service';
import { EmailTemplateService } from './email-template.service';

describe('CheckoutInvoiceEmailService', () => {
  const reservationsRepository = {
    findOne: jest.fn(),
  } as unknown as Repository<ReservationEntity>;

  const propertiesRepository = {
    findOne: jest.fn(),
  } as unknown as Repository<PropertyEntity>;

  const invoicesRepository = {
    findOne: jest.fn(),
  } as unknown as Repository<InvoiceEntity>;

  const notificationService = {
    isEmailConfigured: jest.fn(),
    queueEmail: jest.fn(),
    queueEmailResend: jest.fn(),
    sendEmail: jest.fn(),
  } as unknown as NotificationService;

  const emailTemplateService = {
    checkoutInvoice: jest.fn(),
  } as unknown as EmailTemplateService;

  const receiptPdfService = {
    generateTaxInvoice: jest.fn(),
  } as unknown as ReceiptPdfService;

  let service: CheckoutInvoiceEmailService;

  const reservation = {
    id: 'reservation-1',
    propertyId: 'property-1',
    status: ReservationStatus.CHECKED_OUT,
    reservationCode: 'ST-1001',
    arrivalDate: '2026-08-20',
    departureDate: '2026-08-22',
    guest: {
      id: 'guest-1',
      displayName: 'Priya Verma',
      email: 'priya@example.com',
    },
  } as unknown as ReservationEntity;

  const property = {
    id: 'property-1',
    name: 'Example Hotel',
    email: 'frontdesk@example.com',
    phone: '+91 9999999999',
    logoUrl: 'https://example.com/logo.png',
    emailNotificationsEnabled: true,
  } as unknown as PropertyEntity;

  const invoice = {
    id: 'invoice-1',
    propertyId: 'property-1',
    folioId: 'folio-1',
    reservationId: 'reservation-1',
    guestId: 'guest-1',
    type: InvoiceType.TAX_INVOICE,
    status: InvoiceStatus.FINALIZED,
    invoiceNumber: 'INV/2026-27/0001',
    fyLabel: '2026-27',
    currency: 'INR',
    placeOfSupply: 'INTRA_STATE',
    grandTotal: '11800.00',

    seller: {
      name: 'Example Hotel',
      legalName: 'Example Hotel Private Limited',
      gstin: '23ABCDE1234F1Z5',
      addressLine1: 'MG Road',
      addressLine2: null,
      city: 'Indore',
      state: 'Madhya Pradesh',
      stateCode: '23',
      postalCode: '452001',
      country: 'India',
      phone: '+91 9999999999',
      email: 'frontdesk@example.com',
    },

    buyer: {
      name: 'Priya Verma',
      gstin: null,
      addressLine1: null,
      city: null,
      state: null,
      stateCode: null,
      postalCode: null,
      country: 'India',
      phone: '+91 9000000000',
      email: 'priya@example.com',
    },

    reservation: {
      reservationCode: 'ST-1001',
      folioNumber: 'FOL-1001',
      arrivalDate: '2026-08-20',
      departureDate: '2026-08-22',
    },

    lines: [
      {
        type: 'ROOM',
        description: 'Room charges',
        hsnSac: '996311',
        quantity: '2',
        unitAmount: '5000.00',
        taxableValue: '10000.00',
        cgst: {
          rate: '6.00',
          amount: '600.00',
        },
        sgst: {
          rate: '6.00',
          amount: '600.00',
        },
        igst: {
          rate: '0.00',
          amount: '0.00',
        },
        lineTotal: '11200.00',
      },
    ],

    totals: {
      subtotal: '10000.00',
      discountTotal: '0.00',
      taxableTotal: '10000.00',
      cgstTotal: '600.00',
      sgstTotal: '600.00',
      igstTotal: '0.00',
      taxTotal: '1200.00',
      grandTotal: '11200.00',
      paid: '11200.00',
      balance: '0.00',
    },

    payments: [
      {
        method: 'CARD',
        amount: '11200.00',
        reference: 'TXN-1001',
        receivedAt: '2026-08-22T10:00:00.000Z',
      },
    ],

    settledAt: new Date('2026-08-22T10:00:00.000Z'),
    originalInvoiceId: null,
    voidReason: null,
    idempotencyKey: 'checkout:reservation-1',
    createdByUserId: 'user-1',
    issuedAt: new Date('2026-08-22T10:01:00.000Z'),
    createdAt: new Date('2026-08-22T10:01:00.000Z'),
    updatedAt: new Date('2026-08-22T10:01:00.000Z'),
  } as unknown as InvoiceEntity;

  const renderedTemplate = {
    subject: 'Your invoice for Example Hotel',
    html: '<html><body>Final tax invoice attached</body></html>',
    text: 'Final tax invoice attached',
  };

  const delivery = {
    id: 'delivery-1',
  } as NotificationDeliveryEntity;

  beforeEach(() => {
    jest.clearAllMocks();

    (notificationService.isEmailConfigured as jest.Mock).mockReturnValue(true);

    (reservationsRepository.findOne as jest.Mock).mockResolvedValue(reservation);
    (propertiesRepository.findOne as jest.Mock).mockResolvedValue(property);
    (invoicesRepository.findOne as jest.Mock).mockResolvedValue(invoice);

    (notificationService.queueEmail as jest.Mock).mockResolvedValue(delivery);
    (notificationService.queueEmailResend as jest.Mock).mockResolvedValue({
      id: 'delivery-resend-1',
    } as NotificationDeliveryEntity);

    (receiptPdfService.generateTaxInvoice as jest.Mock).mockResolvedValue(
      Buffer.from('fake-tax-invoice-pdf'),
    );

    (emailTemplateService.checkoutInvoice as jest.Mock).mockReturnValue(renderedTemplate);

    (notificationService.sendEmail as jest.Mock).mockResolvedValue(delivery);

    service = new CheckoutInvoiceEmailService(
      reservationsRepository,
      propertiesRepository,
      invoicesRepository,
      notificationService,
      emailTemplateService,
      receiptPdfService,
    );
  });

  it('queues a checkout invoice email and attaches the finalized tax-invoice PDF', async () => {
    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: true,
      deliveryId: 'delivery-1',
    });

    expect(reservationsRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'reservation-1',
        propertyId: 'property-1',
      },
      relations: {
        guest: true,
      },
    });

    expect(propertiesRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'property-1',
      },
    });

    expect(invoicesRepository.findOne).toHaveBeenCalledWith({
      where: {
        propertyId: 'property-1',
        reservationId: 'reservation-1',
        type: InvoiceType.TAX_INVOICE,
        status: InvoiceStatus.FINALIZED,
      },
      order: {
        issuedAt: 'DESC',
        createdAt: 'DESC',
      },
    });

    expect(notificationService.queueEmail).toHaveBeenCalledWith({
      propertyId: 'property-1',
      notificationType: expect.anything(),
      entityType: 'RESERVATION',
      entityId: 'reservation-1',
      recipient: 'priya@example.com',
    });

    expect(notificationService.queueEmailResend).not.toHaveBeenCalled();

    expect(receiptPdfService.generateTaxInvoice).toHaveBeenCalledTimes(1);
    expect(receiptPdfService.generateTaxInvoice).toHaveBeenCalledWith(invoice);

    expect(emailTemplateService.checkoutInvoice).toHaveBeenCalledWith({
      property: {
        name: 'Example Hotel',
        email: 'frontdesk@example.com',
        phone: '+91 9999999999',
        logoUrl: 'https://example.com/logo.png',
      },
      guestName: 'Priya Verma',
      reservationCode: 'ST-1001',
      invoiceNumber: 'INV/2026-27/0001',
      arrivalDate: '2026-08-20',
      departureDate: '2026-08-22',
      totalPaid: '11200.00',
      currency: 'INR',
    });

    expect(notificationService.sendEmail).toHaveBeenCalledWith('delivery-1', {
      subject: renderedTemplate.subject,
      html: renderedTemplate.html,
      text: renderedTemplate.text,
      attachments: [
        {
          filename: 'TaxInvoice-INV-2026-27-0001.pdf',
          content: Buffer.from('fake-tax-invoice-pdf'),
          contentType: 'application/pdf',
        },
      ],
    });
  });

  it('creates a fresh notification delivery for an explicit resend', async () => {
    await expect(service.resend('property-1', 'reservation-1')).resolves.toEqual({
      queued: true,
      deliveryId: 'delivery-resend-1',
    });

    expect(notificationService.queueEmail).not.toHaveBeenCalled();

    expect(notificationService.queueEmailResend).toHaveBeenCalledWith({
      propertyId: 'property-1',
      notificationType: expect.anything(),
      entityType: 'RESERVATION',
      entityId: 'reservation-1',
      recipient: 'priya@example.com',
    });

    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      'delivery-resend-1',
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: 'TaxInvoice-INV-2026-27-0001.pdf',
            contentType: 'application/pdf',
          }),
        ],
      }),
    );
  });

  it('does nothing when email integration is disabled', async () => {
    (notificationService.isEmailConfigured as jest.Mock).mockReturnValue(false);

    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: false,
      reason: 'EMAIL_DISABLED',
    });

    expect(reservationsRepository.findOne).not.toHaveBeenCalled();
    expect(propertiesRepository.findOne).not.toHaveBeenCalled();
    expect(invoicesRepository.findOne).not.toHaveBeenCalled();
    expect(notificationService.queueEmail).not.toHaveBeenCalled();
    expect(receiptPdfService.generateTaxInvoice).not.toHaveBeenCalled();
    expect(notificationService.sendEmail).not.toHaveBeenCalled();
  });

  it('does nothing when property email notifications are disabled', async () => {
    (propertiesRepository.findOne as jest.Mock).mockResolvedValue({
      ...property,
      emailNotificationsEnabled: false,
    });

    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: false,
      reason: 'PROPERTY_EMAIL_DISABLED',
    });

    expect(invoicesRepository.findOne).not.toHaveBeenCalled();
    expect(notificationService.queueEmail).not.toHaveBeenCalled();
    expect(receiptPdfService.generateTaxInvoice).not.toHaveBeenCalled();
    expect(notificationService.sendEmail).not.toHaveBeenCalled();
  });

  it('does nothing when the reservation is not checked out', async () => {
    (reservationsRepository.findOne as jest.Mock).mockResolvedValue({
      ...reservation,
      status: ReservationStatus.CHECKED_IN,
    });

    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: false,
      reason: 'NOT_CHECKED_OUT',
    });

    expect(invoicesRepository.findOne).not.toHaveBeenCalled();
    expect(notificationService.queueEmail).not.toHaveBeenCalled();
    expect(receiptPdfService.generateTaxInvoice).not.toHaveBeenCalled();
    expect(notificationService.sendEmail).not.toHaveBeenCalled();
  });

  it('does nothing when the guest has no email address', async () => {
    (reservationsRepository.findOne as jest.Mock).mockResolvedValue({
      ...reservation,
      guest: {
        ...reservation.guest,
        email: null,
      },
    });

    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: false,
      reason: 'NO_GUEST_EMAIL',
    });

    expect(invoicesRepository.findOne).not.toHaveBeenCalled();
    expect(notificationService.queueEmail).not.toHaveBeenCalled();
    expect(receiptPdfService.generateTaxInvoice).not.toHaveBeenCalled();
    expect(notificationService.sendEmail).not.toHaveBeenCalled();
  });

  it('does nothing when no finalized tax invoice exists', async () => {
    (invoicesRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: false,
      reason: 'NO_FINALIZED_INVOICE',
    });

    expect(notificationService.queueEmail).not.toHaveBeenCalled();
    expect(notificationService.queueEmailResend).not.toHaveBeenCalled();
    expect(receiptPdfService.generateTaxInvoice).not.toHaveBeenCalled();
    expect(notificationService.sendEmail).not.toHaveBeenCalled();
  });

  it('does nothing when the finalized invoice has no invoice number', async () => {
    (invoicesRepository.findOne as jest.Mock).mockResolvedValue({
      ...invoice,
      invoiceNumber: null,
    });

    await expect(service.queueAutomatic('property-1', 'reservation-1')).resolves.toEqual({
      queued: false,
      reason: 'NO_FINALIZED_INVOICE',
    });

    expect(notificationService.queueEmail).not.toHaveBeenCalled();
    expect(receiptPdfService.generateTaxInvoice).not.toHaveBeenCalled();
    expect(notificationService.sendEmail).not.toHaveBeenCalled();
  });

  it('uses the immutable invoice buyer name if the reservation guest display name is unavailable', async () => {
    (reservationsRepository.findOne as jest.Mock).mockResolvedValue({
      ...reservation,
      guest: {
        ...reservation.guest,
        displayName: '',
      },
    });

    await service.queueAutomatic('property-1', 'reservation-1');

    expect(emailTemplateService.checkoutInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        guestName: 'Priya Verma',
      }),
    );
  });
});
