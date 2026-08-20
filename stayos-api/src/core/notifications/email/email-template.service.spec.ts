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

  it('renders booking confirmation with committed stay commercial details', () => {
    const result = service.bookingConfirmation({
      property: {
        name: 'Example Hotel',
      },
      guestName: 'Priya Verma',
      reservationCode: 'ST-1002',
      arrivalDate: '2026-08-20',
      departureDate: '2026-08-22',
      roomType: 'Deluxe',
      adults: 2,
      children: 0,
      ratePlanName: 'Best Available Rate',
      mealPlan: 'BREAKFAST',
      refundable: true,
      roomAmount: '10000.00',
      taxAmount: '1200.00',
      totalAmount: '11200.00',
      paidAmount: '2000.00',
      balanceAmount: '9200.00',
      currency: 'INR',
    });

    expect(result.html).toContain('Breakfast included');
    expect(result.html).toContain('Refundable');
    expect(result.html).toContain('Best Available Rate');

    expect(result.text).toContain('Breakfast included');
    expect(result.text).toContain('Refundable');

    expect(result.html).toContain('₹10,000.00');
    expect(result.html).toContain('₹1,200.00');
    expect(result.html).toContain('₹11,200.00');
    expect(result.html).toContain('₹2,000.00');
    expect(result.html).toContain('₹9,200.00');
  });

  it('renders room-only and non-refundable booking details', () => {
    const result = service.bookingConfirmation({
      property: {
        name: 'Example Hotel',
      },
      guestName: 'Priya Verma',
      reservationCode: 'ST-1003',
      arrivalDate: '2026-08-20',
      departureDate: '2026-08-21',
      roomType: 'Standard',
      adults: 1,
      children: 0,
      mealPlan: 'ROOM_ONLY',
      refundable: false,
      currency: 'INR',
    });

    expect(result.html).toContain('Room only');
    expect(result.html).toContain('Non-refundable');

    expect(result.text).toContain('Room only');
    expect(result.text).toContain('Non-refundable');
  });

  it('renders checkout tax-invoice email using the simple guest-facing template', () => {
    const result = service.checkoutInvoice({
      property: {
        name: 'Example Hotel',
        phone: '+91 9999999999',
        email: 'frontdesk@example.com',
        logoUrl: 'https://example.com/logo.png',
      },
      guestName: 'Priya Verma',

      // These remain part of the input contract even though the simplified
      // email intentionally leaves financial details inside the attached PDF.
      reservationCode: 'ST-1001',
      invoiceNumber: 'INV-1001',
      arrivalDate: '2026-08-20',
      departureDate: '2026-08-22',
      totalPaid: '11800.00',
      currency: 'INR',
    });

    expect(result.subject).toBe('Your invoice for Example Hotel');

    expect(result.html).toContain('Hi Priya Verma');
    expect(result.html).toContain('Thank you for staying with Example Hotel');
    expect(result.html).toContain('Please find attached a copy of your final tax invoice.');
    expect(result.html).toContain('We look forward to welcoming you again.');
    expect(result.html).toContain('Safe travels');
    expect(result.html).toContain('Team Example Hotel');

    expect(result.html).toContain('+91 9999999999');
    expect(result.html).toContain('frontdesk@example.com');
    expect(result.html).toContain('Powered by StayOS');
    expect(result.html).toContain('https://example.com/logo.png');

    expect(result.text).toContain('Hi Priya Verma');
    expect(result.text).toContain('Thank you for staying with Example Hotel.');
    expect(result.text).toContain('Please find attached a copy of your final tax invoice.');
    expect(result.text).toContain('Team Example Hotel');
    expect(result.text).toContain('+91 9999999999');
    expect(result.text).toContain('frontdesk@example.com');

    // Financial/legal detail belongs in the attached finalized tax-invoice PDF,
    // not in this intentionally simple email body.
    expect(result.html).not.toContain('₹11,800.00');
    expect(result.html).not.toContain('Total paid');
    expect(result.html).not.toContain('INV-1001');
  });

  it('renders checkout email cleanly when property support details and logo are absent', () => {
    const result = service.checkoutInvoice({
      property: {
        name: 'Example Hotel',
      },
      guestName: 'Priya Verma',
      reservationCode: 'ST-1001',
    });

    expect(result.subject).toBe('Your invoice for Example Hotel');

    expect(result.html).toContain('Example Hotel');
    expect(result.html).toContain('Hi Priya Verma');
    expect(result.html).toContain('Please find attached a copy of your final tax invoice.');

    expect(result.html).not.toContain('Need help with your stay?');

    expect(result.text).toContain('Please find attached a copy of your final tax invoice.');
  });
});
