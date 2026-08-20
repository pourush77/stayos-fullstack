import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EmailTemplateService } from '../src/core/notifications/email/email-template.service';
import { ReceiptPdfService } from '../src/core/billing/receipt-pdf.service';

async function main() {
  const emailTemplateService = new EmailTemplateService();
  const receiptPdfService = new ReceiptPdfService();

  const property = {
    name: 'Hillston Resort & Club',
    email: 'reservations@hillstonresorts.com',
    phone: '+91 98765 43210',
    address: 'Survey No. 199 & 201, Ralamandal, Indore, Madhya Pradesh 452020',
    logoUrl:
      ' https://d34hmiuaex7c0.cloudfront.net/7648/uploads/page_featured_img_1786691150924.png',
  };

  const email = emailTemplateService.checkoutInvoice({
    property,
    guestName: 'Pourush Singh Gaur',
    reservationCode: 'HS-2026-0822',
    invoiceNumber: 'INV/2026-27/0001',
    arrivalDate: '2026-08-22',
    departureDate: '2026-08-24',
    totalPaid: '11800.00',
    currency: 'INR',
  });

  // Preview snapshot only. `as any` deliberately keeps this script independent
  // of persistence-only InvoiceEntity fields while exercising the real renderer.
  const invoice = {
    invoiceNumber: 'INV/2026-27/0001',
    fyLabel: '2026-27',
    issuedAt: new Date('2026-08-24T11:30:00+05:30'),
    createdAt: new Date('2026-08-24T11:30:00+05:30'),
    placeOfSupply: 'MADHYA_PRADESH',

    seller: {
      name: 'Hillston Resort & Club',
      legalName: 'Hillston Resort & Club',
      gstin: '23ABCDE1234F1Z5',
      phone: '+91 98765 43210',
      email: 'reservations@hillstonresorts.com',
      addressLine1: 'Survey No. 199 & 201',
      addressLine2: 'Ralamandal',
      city: 'Indore',
      state: 'Madhya Pradesh',
      postalCode: '452020',
      country: 'India',
      logoUrl:
        'https://d34hmiuaex7c0.cloudfront.net/7648/uploads/page_featured_img_1786691150924.png',
    },

    buyer: {
      name: 'Pourush Singh Gaur',
      email: 'pourushisonline@gmail.com',
      phone: '+91 99999 99999',
      gstin: null,
      addressLine1: 'Indore',
      city: 'Indore',
      state: 'Madhya Pradesh',
      postalCode: '452001',
      country: 'India',
    },

    reservation: {
      reservationCode: 'HS-2026-0822',
      folioNumber: 'FOL-2026-0001',
      arrivalDate: '2026-08-22',
      departureDate: '2026-08-24',
    },

    lines: [
      {
        type: 'ROOM',
        description: 'Deluxe Room · 2 nights',
        hsnSac: '996311',
        taxableValue: '10000.00',
        cgst: { rate: '9.00', amount: '900.00' },
        sgst: { rate: '9.00', amount: '900.00' },
        igst: { rate: '0.00', amount: '0.00' },
        lineTotal: '11800.00',
      },
    ],

    totals: {
      subtotal: '10000.00',
      cgstTotal: '900.00',
      sgstTotal: '900.00',
      igstTotal: '0.00',
      taxTotal: '1800.00',
      grandTotal: '11800.00',
      paid: '11800.00',
      balance: '0.00',
    },

    payments: [
      {
        method: 'CARD',
        amount: '11800.00',
        reference: 'PREVIEW-TXN-001',
      },
    ],
  } as any;

  const pdf = await receiptPdfService.generateTaxInvoice(invoice);

  const htmlPath = join(process.cwd(), 'checkout-invoice-email-preview.html');
  const pdfPath = join(process.cwd(), 'checkout-tax-invoice-preview.pdf');

  writeFileSync(htmlPath, email.html, 'utf8');
  writeFileSync(pdfPath, pdf);

  console.log('');
  console.log('Preview generated successfully.');
  console.log(`Subject: ${email.subject}`);
  console.log(`HTML: ${htmlPath}`);
  console.log(`PDF:  ${pdfPath}`);
  console.log('');
  console.log('Open with:');
  console.log('  start checkout-invoice-email-preview.html');
  console.log('  start checkout-tax-invoice-preview.pdf');
}

void main().catch((error) => {
  console.error('Unable to generate checkout preview.');
  console.error(error);
  process.exitCode = 1;
});
