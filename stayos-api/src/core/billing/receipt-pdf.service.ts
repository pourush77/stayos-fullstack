import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument: new (options?: unknown) => PDFDoc = require('pdfkit');
type PDFDoc = {
  on(event: string, cb: (chunk: Buffer) => void): PDFDoc;
  fillColor(color: string): PDFDoc;
  fontSize(size: number): PDFDoc;
  font(name: string): PDFDoc;
  text(text: string, x?: number | { align?: string }, y?: number, opts?: unknown): PDFDoc;
  moveDown(amount?: number): PDFDoc;
  moveTo(x: number, y: number): PDFDoc;
  lineTo(x: number, y: number): PDFDoc;
  strokeColor(color: string): PDFDoc;
  stroke(): PDFDoc;
  rect(x: number, y: number, w: number, h: number): PDFDoc;
  fill(): PDFDoc;
  lineWidth(w: number): PDFDoc;
  end(): void;
  y: number;
  page: { height: number };
};
import type { FolioEntity } from './infrastructure/folio.entity';
import type { FolioPaymentEntity } from './infrastructure/folio-payment.entity';
import type { FolioChargeEntity } from './infrastructure/folio-charge.entity';

const BRAND_PURPLE = '#6d28d9';
const MUTED = '#64748b';
const TEXT = '#101828';

function inr(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

function shortDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

@Injectable()
export class ReceiptPdfService {
  async generate(input: {
    folio: FolioEntity;
    totals: { total: string; paid: string; balance: string };
    charges: FolioChargeEntity[];
    payments: FolioPaymentEntity[];
    payment: FolioPaymentEntity;
    hotelName: string;
    guestName: string;
    reservationCode: string;
    roomNumber?: string;
    stay?: { arrival: string; departure: string };
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    // Header
    doc.fillColor(BRAND_PURPLE).fontSize(22).font('Helvetica-Bold').text(input.hotelName, { align: 'left' });
    doc.moveDown(0.2);
    doc.fillColor(MUTED).fontSize(10).font('Helvetica').text('Payment Receipt', { align: 'left' });
    doc.moveTo(42, doc.y + 6).lineTo(553, doc.y + 6).strokeColor('#e2e8f0').stroke();
    doc.moveDown(1);

    // Meta grid
    const metaY = doc.y;
    doc.fillColor(MUTED).fontSize(9).font('Helvetica').text('RECEIPT NO.', 42, metaY);
    doc.fillColor(TEXT).fontSize(11).font('Helvetica-Bold').text(input.payment.id.slice(0, 8).toUpperCase(), 42, metaY + 12);
    doc.fillColor(MUTED).fontSize(9).font('Helvetica').text('DATE', 220, metaY);
    doc.fillColor(TEXT).fontSize(11).font('Helvetica-Bold').text(shortDate(input.payment.createdAt ?? new Date()), 220, metaY + 12);
    doc.fillColor(MUTED).fontSize(9).font('Helvetica').text('FOLIO', 380, metaY);
    doc.fillColor(TEXT).fontSize(11).font('Helvetica-Bold').text(input.folio.folioNumber, 380, metaY + 12);
    doc.moveDown(3);

    // Guest section
    doc.fillColor(MUTED).fontSize(9).font('Helvetica').text('BILL TO');
    doc.fillColor(TEXT).fontSize(14).font('Helvetica-Bold').text(input.guestName);
    doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(`Reservation ${input.reservationCode}${input.roomNumber ? ` · Room ${input.roomNumber}` : ''}`);
    if (input.stay) {
      doc.text(`Stay: ${shortDate(input.stay.arrival)} → ${shortDate(input.stay.departure)}`);
    }
    doc.moveDown(1);

    // Payment box
    doc.rect(42, doc.y, 511, 60).fillColor('#f6f1ff').fill().strokeColor(BRAND_PURPLE).lineWidth(1).stroke();
    const boxTop = doc.y - 60;
    doc.fillColor(MUTED).fontSize(9).font('Helvetica').text('AMOUNT PAID', 60, boxTop + 12);
    doc.fillColor(BRAND_PURPLE).fontSize(24).font('Helvetica-Bold').text(inr(input.payment.amount), 60, boxTop + 24);
    doc.fillColor(MUTED).fontSize(9).font('Helvetica').text('METHOD', 380, boxTop + 12);
    doc.fillColor(TEXT).fontSize(14).font('Helvetica-Bold').text(input.payment.method, 380, boxTop + 24);
    if (input.payment.reference) {
      doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(`Ref: ${input.payment.reference}`, 380, boxTop + 44);
    }
    doc.y = boxTop + 60;
    doc.moveDown(1.5);

    // Charges summary
    doc.fillColor(TEXT).fontSize(12).font('Helvetica-Bold').text('Bill summary');
    doc.moveDown(0.3);
    const rowY = doc.y;
    doc.fillColor(MUTED).fontSize(9).font('Helvetica');
    doc.text('DESCRIPTION', 42, rowY);
    doc.text('AMOUNT', 480, rowY, { width: 73, align: 'right' });
    doc.moveTo(42, rowY + 14).lineTo(553, rowY + 14).strokeColor('#e2e8f0').stroke();
    doc.y = rowY + 20;
    doc.fillColor(TEXT).fontSize(10).font('Helvetica');
    input.charges.slice(0, 12).forEach((charge) => {
      const y = doc.y;
      doc.text(`${charge.description ?? charge.type}`, 42, y, { width: 430 });
      doc.text(inr(charge.amount), 480, y, { width: 73, align: 'right' });
      doc.moveDown(0.5);
    });

    // Totals
    doc.moveDown(0.5);
    doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.5);

    const t = input.totals;
    const totalsY = doc.y;
    doc.fillColor(MUTED).fontSize(10).font('Helvetica').text('Total charges', 320, totalsY, { width: 160, align: 'right' });
    doc.fillColor(TEXT).font('Helvetica-Bold').text(inr(t.total ?? '0'), 480, totalsY, { width: 73, align: 'right' });
    doc.moveDown(0.4);
    const paidY = doc.y;
    doc.fillColor(MUTED).font('Helvetica').text('Paid', 320, paidY, { width: 160, align: 'right' });
    doc.fillColor('#166534').font('Helvetica-Bold').text(inr(t.paid ?? '0'), 480, paidY, { width: 73, align: 'right' });
    doc.moveDown(0.4);
    const balY = doc.y;
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(12).text('Balance', 320, balY, { width: 160, align: 'right' });
    doc.fillColor(Number(t.balance ?? 0) > 0.01 ? '#b45309' : '#166534').font('Helvetica-Bold').fontSize(12).text(inr(t.balance ?? '0'), 480, balY, { width: 73, align: 'right' });

    // Footer
    doc.moveDown(3);
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(
      'Thank you for your stay. This is a computer-generated receipt; a physical signature is not required.',
      42,
      doc.page.height - 60,
      { width: 511, align: 'center' },
    );

    doc.end();
    return done;
  }
}
