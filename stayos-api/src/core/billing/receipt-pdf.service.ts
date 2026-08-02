import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument: new (options?: unknown) => PDFDoc = require('pdfkit');
type PDFDoc = {
  on(event: string, cb: (chunk: Buffer) => void): PDFDoc;
  fillColor(color: string): PDFDoc;
  fontSize(size: number): PDFDoc;
  font(name: string): PDFDoc;
  registerFont(name: string, src: string): PDFDoc;
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

const PAGE_LEFT = 42;
const PAGE_RIGHT = 553;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;
const BRAND = '#6d28d9';
const BRAND_DARK = '#4c1d95';
const BORDER = '#dbe4ef';
const PANEL = '#f8fafc';
const TEXT = '#101828';
const MUTED = '#64748b';
const GREEN = '#166534';
const ORANGE = '#b45309';

function findCurrencyFonts(): { regular: string; bold: string } | null {
  const candidates = [
    { regular: 'C:/Windows/Fonts/Nirmala.ttf', bold: 'C:/Windows/Fonts/NirmalaB.ttf' },
    { regular: 'C:/Windows/Fonts/arial.ttf', bold: 'C:/Windows/Fonts/arialbd.ttf' },
    { regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' },
    { regular: '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf', bold: '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf' },
  ];
  return candidates.find((font) => existsSync(font.regular) && existsSync(font.bold)) ?? null;
}

function formatMoney(value: string | number, useRupeeSymbol: boolean): string {
  const n = typeof value === 'number' ? value : Number(value);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
  return `${useRupeeSymbol ? '₹' : 'Rs. '}${formatted}`;
}

function numeric(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function dateText(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateTimeText(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function labelValue(doc: PDFDoc, label: string, value: string, x: number, y: number, width: number) {
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x, y, { width });
  doc.fillColor(TEXT).font('Helvetica').fontSize(9).text(value || '-', x, y + 10, { width });
}

function sectionTitle(doc: PDFDoc, title: string, y: number) {
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(10.5).text(title, PAGE_LEFT, y);
  doc.moveTo(PAGE_LEFT, y + 15).lineTo(PAGE_RIGHT, y + 15).strokeColor(BORDER).lineWidth(1).stroke();
}

@Injectable()
export class ReceiptPdfService {
  async generate(input: {
    folio: FolioEntity;
    totals: { total: string; paid: string; balance: string };
    charges: FolioChargeEntity[];
    payments: FolioPaymentEntity[];
    payment: FolioPaymentEntity;
    property: {
      name: string;
      legalName?: string | null;
      gstNumber?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
    };
    guestName: string;
    reservationCode: string;
    roomNumber?: string;
    stay?: { arrival: string; departure: string };
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_LEFT });
    const currencyFonts = findCurrencyFonts();
    const useRupeeSymbol = Boolean(currencyFonts);
    if (currencyFonts) {
      doc.registerFont('Helvetica', currencyFonts.regular);
      doc.registerFont('Helvetica-Bold', currencyFonts.bold);
    }
    const formatAmount = (value: string | number) => formatMoney(value, useRupeeSymbol);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const total = numeric(input.totals.total);
    const paid = numeric(input.totals.paid);
    const balance = numeric(input.totals.balance);
    const receiptNo = `RCPT-${input.payment.id.slice(0, 8).toUpperCase()}`;
    const status = balance > 0.01 ? 'PARTIALLY PAID' : 'PAID';

    // Compact property header
    doc.rect(0, 0, 595, 82).fillColor(BRAND).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(input.property.name, PAGE_LEFT, 22, { width: 255 });
    doc.fillColor('#ede9fe').font('Helvetica').fontSize(8).text(input.property.legalName ?? 'Hotel', PAGE_LEFT, 45, { width: 255 });
    doc.fillColor('#ede9fe').font('Helvetica').fontSize(7.5).text(input.property.address ?? '-', PAGE_LEFT, 57, { width: 300, lineGap: 1 });
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('PAYMENT RECEIPT', 330, 20, { width: 223, align: 'right' });
    doc.fillColor('#ede9fe').font('Helvetica').fontSize(8).text(receiptNo, 330, 46, { width: 223, align: 'right' });
    doc.fillColor('#ede9fe').font('Helvetica').fontSize(7.5).text(
      [
        input.property.gstNumber ? `GSTIN ${input.property.gstNumber}` : null,
        input.property.phone,
        input.property.email,
      ].filter(Boolean).join(' | '),
      330,
      58,
      { width: 223, align: 'right' },
    );

    // Status strip
    doc.rect(PAGE_LEFT, 100, PAGE_WIDTH, 54).fillColor('#ffffff').fill().strokeColor(BORDER).lineWidth(1).stroke();
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5).text('AMOUNT RECEIVED', 62, 113);
    doc.fillColor(BRAND_DARK).font('Helvetica-Bold').fontSize(20).text(formatAmount(input.payment.amount), 62, 126);
    doc.rect(382, 114, 126, 24).fillColor(balance > 0.01 ? '#fff7ed' : '#ecfdf5').fill();
    doc.fillColor(balance > 0.01 ? ORANGE : GREEN).font('Helvetica-Bold').fontSize(8.5).text(status, 394, 122, { width: 102, align: 'center' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(`Received ${dateTimeText(input.payment.receivedAt ?? input.payment.createdAt ?? new Date())}`, 62, 153);

    // Receipt and guest details
    sectionTitle(doc, 'Receipt details', 178);
    labelValue(doc, 'Folio No.', input.folio.folioNumber, 42, 204, 145);
    labelValue(doc, 'Reservation', input.reservationCode, 205, 204, 145);
    labelValue(doc, 'Payment Method', input.payment.method.replace(/_/g, ' '), 368, 204, 145);
    labelValue(doc, 'Reference', input.payment.reference ?? '-', 42, 238, 220);
    labelValue(doc, 'Guest', input.guestName, 285, 238, 220);
    if (input.stay) {
      labelValue(doc, 'Stay Dates', `${dateText(input.stay.arrival)} to ${dateText(input.stay.departure)}`, 42, 272, 220);
    }
    labelValue(doc, 'Room', input.roomNumber ?? '-', 285, 272, 220);

    // Charges table
    const tableTop = 340;
    sectionTitle(doc, 'Bill summary', tableTop - 26);
    doc.rect(PAGE_LEFT, tableTop, PAGE_WIDTH, 21).fillColor(PANEL).fill().strokeColor(BORDER).stroke();
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5);
    doc.text('DESCRIPTION', 52, tableTop + 7, { width: 230 });
    doc.text('QTY', 302, tableTop + 7, { width: 40, align: 'right' });
    doc.text('RATE', 350, tableTop + 7, { width: 70, align: 'right' });
    doc.text('GST', 430, tableTop + 7, { width: 50, align: 'right' });
    doc.text('TOTAL', 490, tableTop + 7, { width: 53, align: 'right' });

    let y = tableTop + 28;
    const rows = input.charges.length > 0 ? input.charges.slice(0, 8) : [];
    rows.forEach((charge) => {
      const amount = numeric(charge.amount);
      const tax = numeric(charge.taxAmount);
      const lineTotal = amount + tax;
      doc.fillColor(TEXT).font('Helvetica').fontSize(8.5);
      doc.text(charge.description || charge.type, 52, y, { width: 230 });
      doc.text(String(charge.quantity ?? 1), 302, y, { width: 40, align: 'right' });
      doc.font('Helvetica-Bold').text(formatAmount(charge.unitAmount ?? amount), 350, y, { width: 70, align: 'right' });
      doc.font('Helvetica-Bold').text(formatAmount(tax), 430, y, { width: 50, align: 'right' });
      doc.font('Helvetica-Bold').text(formatAmount(lineTotal), 490, y, { width: 53, align: 'right' });
      doc.moveTo(PAGE_LEFT, y + 16).lineTo(PAGE_RIGHT, y + 16).strokeColor('#eef2f7').lineWidth(1).stroke();
      y += 23;
    });

    if (rows.length === 0) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('No bill charges found for this folio.', 52, y);
      y += 28;
    }

    // Totals panel
    const totalsY = Math.max(y + 6, 460);
    doc.rect(330, totalsY, 223, 76).fillColor('#ffffff').fill().strokeColor(BORDER).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text('Total charges', 348, totalsY + 13, { width: 105 });
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(8.5).text(formatAmount(total), 458, totalsY + 13, { width: 75, align: 'right' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text('Paid so far', 348, totalsY + 32, { width: 105 });
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8.5).text(formatAmount(paid), 458, totalsY + 32, { width: 75, align: 'right' });
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(9.5).text('Balance due', 348, totalsY + 52, { width: 105 });
    doc.fillColor(balance > 0.01 ? ORANGE : GREEN).font('Helvetica-Bold').fontSize(10).text(formatAmount(balance), 458, totalsY + 51, { width: 75, align: 'right' });

    // Payment note
    doc.rect(PAGE_LEFT, totalsY, 245, 76).fillColor('#f6f1ff').fill().strokeColor('#ddd6fe').stroke();
    doc.fillColor(BRAND_DARK).font('Helvetica-Bold').fontSize(9.5).text('Payment recorded', 60, totalsY + 13);
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(8.5).text(
      `This receipt confirms a ${input.payment.method.replace(/_/g, ' ').toLowerCase()} payment of ${formatAmount(input.payment.amount)} against folio ${input.folio.folioNumber}.`,
      60,
      totalsY + 30,
      { width: 205 },
    );

    // Footer
    const footerY = 710;
    doc.moveTo(PAGE_LEFT, footerY).lineTo(PAGE_RIGHT, footerY).strokeColor(BORDER).lineWidth(1).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(
      'Thank you for your stay. This computer-generated receipt is valid without a physical signature.',
      PAGE_LEFT,
      footerY + 14,
      { width: PAGE_WIDTH, align: 'center' },
    );
    doc.fillColor('#94a3b8').fontSize(7).text('Generated by StayOS', PAGE_LEFT, footerY + 30, { width: PAGE_WIDTH, align: 'center' });

    doc.end();
    return done;
  }

  async generateFinalBill(input: {
    folio: FolioEntity;
    totals: { total: string; paid: string; balance: string };
    charges: FolioChargeEntity[];
    payments: FolioPaymentEntity[];
    property: {
      name: string;
      legalName?: string | null;
      gstNumber?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
    };
    guestName: string;
    reservationCode: string;
    roomNumber?: string;
    stay?: { arrival: string; departure: string };
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_LEFT });
    const currencyFonts = findCurrencyFonts();
    const useRupeeSymbol = Boolean(currencyFonts);
    if (currencyFonts) {
      doc.registerFont('Helvetica', currencyFonts.regular);
      doc.registerFont('Helvetica-Bold', currencyFonts.bold);
    }
    const formatAmount = (value: string | number) => formatMoney(value, useRupeeSymbol);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const total = numeric(input.totals.total);
    const paid = numeric(input.totals.paid);
    const balance = numeric(input.totals.balance);
    const billNo = `BILL-${input.folio.folioNumber.replace(/[^A-Z0-9]/gi, '')}`;
    const status = balance > 0.01 ? 'BALANCE DUE' : 'PAID';

    doc.rect(0, 0, 595, 82).fillColor(BRAND).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(input.property.name, PAGE_LEFT, 22, { width: 255 });
    doc.fillColor('#ede9fe').font('Helvetica').fontSize(8).text(input.property.legalName ?? 'Hotel', PAGE_LEFT, 45, { width: 255 });
    doc.fillColor('#ede9fe').font('Helvetica').fontSize(7.5).text(input.property.address ?? '-', PAGE_LEFT, 57, { width: 300, lineGap: 1 });
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('FINAL BILL', 330, 20, { width: 223, align: 'right' });
    doc.fillColor('#ede9fe').font('Helvetica').fontSize(8).text(billNo, 330, 46, { width: 223, align: 'right' });
    doc.fillColor('#ede9fe').font('Helvetica').fontSize(7.5).text(
      [
        input.property.gstNumber ? `GSTIN ${input.property.gstNumber}` : null,
        input.property.phone,
        input.property.email,
      ].filter(Boolean).join(' | '),
      330,
      58,
      { width: 223, align: 'right' },
    );

    doc.rect(PAGE_LEFT, 100, PAGE_WIDTH, 54).fillColor('#ffffff').fill().strokeColor(BORDER).lineWidth(1).stroke();
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5).text('TOTAL BILL', 62, 113);
    doc.fillColor(BRAND_DARK).font('Helvetica-Bold').fontSize(20).text(formatAmount(total), 62, 126);
    doc.rect(382, 114, 126, 24).fillColor(balance > 0.01 ? '#fff7ed' : '#ecfdf5').fill();
    doc.fillColor(balance > 0.01 ? ORANGE : GREEN).font('Helvetica-Bold').fontSize(8.5).text(status, 394, 122, { width: 102, align: 'center' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(`Generated ${dateTimeText(new Date())}`, 62, 153);

    sectionTitle(doc, 'Stay details', 178);
    labelValue(doc, 'Folio No.', input.folio.folioNumber, 42, 204, 145);
    labelValue(doc, 'Reservation', input.reservationCode, 205, 204, 145);
    labelValue(doc, 'Guest', input.guestName, 368, 204, 145);
    if (input.stay) {
      labelValue(doc, 'Stay Dates', `${dateText(input.stay.arrival)} to ${dateText(input.stay.departure)}`, 42, 238, 220);
    }
    labelValue(doc, 'Room', input.roomNumber ?? '-', 285, 238, 220);

    const tableTop = 305;
    sectionTitle(doc, 'Charges', tableTop - 26);
    doc.rect(PAGE_LEFT, tableTop, PAGE_WIDTH, 21).fillColor(PANEL).fill().strokeColor(BORDER).stroke();
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5);
    doc.text('DESCRIPTION', 52, tableTop + 7, { width: 230 });
    doc.text('QTY', 302, tableTop + 7, { width: 40, align: 'right' });
    doc.text('RATE', 350, tableTop + 7, { width: 70, align: 'right' });
    doc.text('GST', 430, tableTop + 7, { width: 50, align: 'right' });
    doc.text('TOTAL', 490, tableTop + 7, { width: 53, align: 'right' });

    let y = tableTop + 28;
    input.charges.slice(0, 9).forEach((charge) => {
      const amount = numeric(charge.amount);
      const tax = numeric(charge.taxAmount);
      doc.fillColor(TEXT).font('Helvetica').fontSize(8.5);
      doc.text(charge.description || charge.type, 52, y, { width: 230 });
      doc.text(String(charge.quantity ?? 1), 302, y, { width: 40, align: 'right' });
      doc.font('Helvetica-Bold').text(formatAmount(charge.unitAmount ?? amount), 350, y, { width: 70, align: 'right' });
      doc.text(formatAmount(tax), 430, y, { width: 50, align: 'right' });
      doc.text(formatAmount(amount + tax), 490, y, { width: 53, align: 'right' });
      doc.moveTo(PAGE_LEFT, y + 16).lineTo(PAGE_RIGHT, y + 16).strokeColor('#eef2f7').lineWidth(1).stroke();
      y += 23;
    });

    const paymentsTop = Math.max(y + 28, 440);
    sectionTitle(doc, 'Payments', paymentsTop - 26);
    doc.rect(PAGE_LEFT, paymentsTop, PAGE_WIDTH, 21).fillColor(PANEL).fill().strokeColor(BORDER).stroke();
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5);
    doc.text('METHOD', 52, paymentsTop + 7, { width: 100 });
    doc.text('AMOUNT', 180, paymentsTop + 7, { width: 90, align: 'right' });
    doc.text('REFERENCE', 300, paymentsTop + 7, { width: 105 });
    doc.text('RECEIVED', 430, paymentsTop + 7, { width: 100 });

    y = paymentsTop + 28;
    input.payments.slice(0, 7).forEach((payment) => {
      doc.fillColor(TEXT).font('Helvetica').fontSize(8.5);
      doc.text(payment.method.replace(/_/g, ' '), 52, y, { width: 100 });
      doc.fillColor(GREEN).font('Helvetica-Bold').text(formatAmount(payment.amount), 180, y, { width: 90, align: 'right' });
      doc.fillColor(TEXT).font('Helvetica').text(payment.reference ?? '-', 300, y, { width: 105 });
      doc.text(dateTimeText(payment.receivedAt ?? payment.createdAt ?? new Date()), 430, y, { width: 100 });
      doc.moveTo(PAGE_LEFT, y + 16).lineTo(PAGE_RIGHT, y + 16).strokeColor('#eef2f7').lineWidth(1).stroke();
      y += 23;
    });

    const totalsY = Math.max(y + 18, 610);
    doc.rect(330, totalsY, 223, 76).fillColor('#ffffff').fill().strokeColor(BORDER).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text('Total charges', 348, totalsY + 13, { width: 105 });
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(8.5).text(formatAmount(total), 458, totalsY + 13, { width: 75, align: 'right' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text('Paid', 348, totalsY + 32, { width: 105 });
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8.5).text(formatAmount(paid), 458, totalsY + 32, { width: 75, align: 'right' });
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(9.5).text('Balance due', 348, totalsY + 52, { width: 105 });
    doc.fillColor(balance > 0.01 ? ORANGE : GREEN).font('Helvetica-Bold').fontSize(10).text(formatAmount(balance), 458, totalsY + 51, { width: 75, align: 'right' });

    const footerY = 710;
    doc.moveTo(PAGE_LEFT, footerY).lineTo(PAGE_RIGHT, footerY).strokeColor(BORDER).lineWidth(1).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(
      'Thank you for your stay. This computer-generated final bill is valid without a physical signature.',
      PAGE_LEFT,
      footerY + 14,
      { width: PAGE_WIDTH, align: 'center' },
    );
    doc.fillColor('#94a3b8').fontSize(7).text('Generated by StayOS', PAGE_LEFT, footerY + 30, { width: PAGE_WIDTH, align: 'center' });

    doc.end();
    return done;
  }
}


