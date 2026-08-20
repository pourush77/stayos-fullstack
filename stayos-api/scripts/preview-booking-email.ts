import { writeFileSync } from 'fs';
import { join } from 'path';
import { EmailTemplateService } from '../src/core/notifications/email/email-template.service';

const templateService = new EmailTemplateService();

const email = templateService.bookingConfirmation({
  property: {
    name: 'Hillston Resort & Club',
    email: 'frontdesk@hillstonresort.com',
    phone: '+91 98765 43210',
    address: 'Survey No. 199 & 201, Ralamandal, Indore, Madhya Pradesh, 452020',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    logoUrl:
      ' https://d34hmiuaex7c0.cloudfront.net/7648/uploads/page_featured_img_1786691150924.png',
  },

  guestName: 'Pourush Singh Gaur',
  reservationCode: 'HS260820-00001',

  arrivalDate: '2026-08-22',
  departureDate: '2026-08-24',

  roomType: 'Deluxe',
  adults: 2,
  children: 1,

  ratePlanName: 'BAR',
  mealPlan: 'ROOM_ONLY',
  refundable: true,

  roomAmount: 7000,
  taxAmount: 840,
  totalAmount: 7840,
  paidAmount: 2000,
  balanceAmount: 5840,

  currency: 'INR',
});

const outputPath = join(process.cwd(), 'booking-confirmation-preview.html');

writeFileSync(outputPath, email.html, 'utf8');

console.log('Booking email preview created:');
console.log(outputPath);
