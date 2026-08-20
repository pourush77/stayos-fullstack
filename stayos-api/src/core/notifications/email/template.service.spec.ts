import { EmailTemplateService } from './email-template.service';

describe('EmailTemplateService', () => {
  const service = new EmailTemplateService();

  it('renders booking confirmation with property and reservation details', () => {
    const result = service.bookingConfirmation({
      property: {
        name: 'Example Hotel',
        phone: '+91 9999999999',
        email: 'frontdesk@example.com',
        address: 'Indore, Madhya Pradesh',
        checkInTime: '14:00:00',
        checkOutTime: '12:00:00',
      },
      guestName: 'Priya Verma',
      reservationCode: 'ST-1001',
      arrivalDate: '2026-08-20',
      departureDate: '2026-08-22',
      roomType: 'Deluxe',
      adults: 2,
      children: 1,
      totalAmount: '11800.00',
      currency: 'INR',
    });

    expect(result.subject).toContain('ST-1001');
    expect(result.html).toContain('Priya Verma');
    expect(result.html).toContain('Example Hotel');
    expect(result.text).toContain('Your booking at Example Hotel is confirmed');
  });

  it('renders checkout email mentioning the attached final bill', () => {
    const result = service.checkoutInvoice({
      property: {
        name: 'Example Hotel',
      },
      guestName: 'Priya Verma',
      reservationCode: 'ST-1001',
      invoiceNumber: 'INV-1001',
      totalPaid: '11800.00',
      currency: 'INR',
    });

    expect(result.subject).toContain('final bill');
    expect(result.text).toContain('final bill is attached');
    expect(result.html).toContain('INV-1001');
  });
});
