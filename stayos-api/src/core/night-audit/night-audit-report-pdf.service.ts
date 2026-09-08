import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import type {
  NightAuditCompletionSnapshot,
  NightAuditCompletionSnapshotV24,
} from './snapshots/night-audit-completion-snapshot';
import { NIGHT_AUDIT_FINANCIAL_SNAPSHOT_VERSION } from './snapshots/night-audit-completion-snapshot';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument: new (options?: unknown) => PDFDoc = require('pdfkit');
type PDFDoc = {
  on(event: string, cb: (chunk: Buffer) => void): PDFDoc;
  fillColor(color: string): PDFDoc;
  fontSize(size: number): PDFDoc;
  font(name: string): PDFDoc;
  registerFont(name: string, src: string): PDFDoc;
  image(src: string | Buffer, x?: number, y?: number, options?: unknown): PDFDoc;
  text(text: string, x?: number | { align?: string }, y?: number, opts?: unknown): PDFDoc;
  moveTo(x: number, y: number): PDFDoc;
  lineTo(x: number, y: number): PDFDoc;
  strokeColor(color: string): PDFDoc;
  stroke(): PDFDoc;
  rect(x: number, y: number, w: number, h: number): PDFDoc;
  fill(): PDFDoc;
  lineWidth(w: number): PDFDoc;
  heightOfString(text: string, opts?: unknown): number;
  end(): void;
  y: number;
};

const PAGE_LEFT = 42;
const PAGE_RIGHT = 553;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;
const BRAND = '#6d28d9';
const BORDER = '#dbe4ef';
const PANEL = '#f8fafc';
const TEXT = '#101828';
const MUTED = '#64748b';

function findCurrencyFonts(): { regular: string; bold: string } | null {
  const candidates = [
    { regular: 'C:/Windows/Fonts/Nirmala.ttf', bold: 'C:/Windows/Fonts/NirmalaB.ttf' },
    {
      regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    },
    {
      regular: '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
      bold: '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
    },
  ];
  return candidates.find((f) => existsSync(f.regular) && existsSync(f.bold)) ?? null;
}

function dateTimeText(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Injectable()
export class NightAuditReportPdfService {
  private useRupee = false;

  async generate(input: {
    snapshot: NightAuditCompletionSnapshot;
    property: { name: string; legalName?: string | null };
    completedAt: string | Date | null;
    completedByUserId?: string | null;
  }): Promise<Buffer> {
    const { snapshot, property } = input;
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_LEFT });
    const fonts = findCurrencyFonts();
    this.useRupee = Boolean(fonts);
    if (fonts) {
      doc.registerFont('Helvetica', fonts.regular);
      doc.registerFont('Helvetica-Bold', fonts.bold);
    }
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    // Header
    doc.rect(0, 0, 595, 84).fillColor(BRAND).fill();
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(property.name, PAGE_LEFT, 20, { width: 300 });
    doc
      .fillColor('#ede9fe')
      .font('Helvetica')
      .fontSize(8)
      .text(property.legalName ?? 'Hotel', PAGE_LEFT, 44, { width: 300 });
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(15)
      .text('DAILY NIGHT AUDIT REPORT', 300, 18, { width: 253, align: 'right' });
    doc
      .fillColor('#ede9fe')
      .font('Helvetica')
      .fontSize(9)
      .text(`Business Date: ${snapshot.businessDate}`, 300, 40, { width: 253, align: 'right' });
    doc
      .fillColor('#ede9fe')
      .fontSize(8)
      .text(
        `Status: CLOSED  |  Completed ${dateTimeText(input.completedAt)}`,
        300,
        56,
        { width: 253, align: 'right' },
      );

    let y = 108;
    if (input.completedByUserId) {
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8)
        .text(`Closed by: ${input.completedByUserId}`, PAGE_LEFT, y);
      y += 16;
    }

    const isV24 = snapshot.version === NIGHT_AUDIT_FINANCIAL_SNAPSHOT_VERSION;
    if (isV24) {
      const fin = (snapshot as NightAuditCompletionSnapshotV24).financial;
      const currency = fin.financialSummary.currency ?? 'INR';
      y = this.rows(doc, y, 'Financial Summary', [
        ['Room Revenue', this.money(fin.financialSummary.roomRevenue, currency)],
        ['Other Charge Revenue', this.money(fin.financialSummary.otherChargeRevenue, currency)],
        ['Gross Charges', this.money(fin.financialSummary.grossCharges, currency)],
        ['Tax', this.money(fin.financialSummary.taxAmount, currency)],
        ['Payments Collected', this.money(fin.financialSummary.paymentsCollected, currency)],
        ['Refunds', this.money(fin.financialSummary.refunds, currency)],
        ['Net Collections', this.money(fin.financialSummary.netCollections, currency)],
        ['Outstanding Balance', this.money(fin.financialSummary.outstandingBalance, currency)],
      ]);

      if (fin.paymentBreakdown.length > 0) {
        y = this.rows(
          doc,
          y,
          'Payment Breakdown',
          fin.paymentBreakdown.map((e): [string, string] => [
            e.method.replace(/_/g, ' '),
            this.money(e.amount, currency),
          ]),
        );
      }

      y = this.rows(doc, y, 'Operations', [
        ['Total Rooms', String(fin.operationalSummary.totalRooms)],
        ['In-House Rooms', String(fin.operationalSummary.inHouseRooms)],
        ['Stayovers', String(fin.operationalSummary.stayovers)],
        ['Arrivals', String(fin.operationalSummary.arrivals)],
        ['Departures', String(fin.operationalSummary.departures)],
        ['No-Shows', String(fin.operationalSummary.noShows)],
      ]);

      y = this.rows(doc, y, 'Groups', [
        ['In-House Groups', String(fin.groupSummary.inHouseGroups)],
        ['Stayover Groups', String(fin.groupSummary.stayoverGroups)],
        ['Master Folio Payments', this.money(fin.groupSummary.masterFolioPaymentsCollected, currency)],
        ['Master Folio Refunds', this.money(fin.groupSummary.masterFolioRefunds, currency)],
      ]);
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(7)
        .text(
          'Group accommodation revenue is tracked separately and is not included in room revenue.',
          PAGE_LEFT,
          y,
          { width: PAGE_WIDTH },
        );
      y += 18;
    } else {
      // NA-V2.1: only fields present in the snapshot (operational counts).
      y = this.rows(doc, y, 'In-House Summary', [
        ['Individual In-House', String(snapshot.inHouseSummary.individualInHouseCount)],
        ['Individual Stayovers', String(snapshot.inHouseSummary.individualStayoverCount)],
        ['Group In-House', String(snapshot.inHouseSummary.groupInHouseCount)],
        ['Group Stayovers', String(snapshot.inHouseSummary.groupStayoverCount)],
      ]);
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(7.5)
        .text(
          'This audit predates financial closing summaries (NA-V2.1); financial figures are not available in its immutable snapshot.',
          PAGE_LEFT,
          y,
          { width: PAGE_WIDTH },
        );
      y += 20;
    }

    // Auditor note (only when present)
    if (snapshot.auditorNote && snapshot.auditorNote.trim()) {
      doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(10.5).text('Night Auditor Note', PAGE_LEFT, y);
      y += 16;
      const note = snapshot.auditorNote.trim();
      const noteHeight = doc.heightOfString(note, { width: PAGE_WIDTH - 24 }) + 20;
      doc
        .rect(PAGE_LEFT, y, PAGE_WIDTH, noteHeight)
        .fillColor(PANEL)
        .fill()
        .strokeColor(BORDER)
        .lineWidth(1)
        .stroke();
      doc
        .fillColor(TEXT)
        .font('Helvetica')
        .fontSize(9)
        .text(note, PAGE_LEFT + 12, y + 10, { width: PAGE_WIDTH - 24 });
      y += noteHeight + 12;
    }

    // Footer
    doc
      .moveTo(PAGE_LEFT, 790)
      .lineTo(PAGE_RIGHT, 790)
      .strokeColor(BORDER)
      .lineWidth(1)
      .stroke();
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(7.5)
      .text(
        `${property.name} · Generated by StayOS on ${dateTimeText(new Date())}`,
        PAGE_LEFT,
        796,
        { width: PAGE_WIDTH, align: 'center' },
      );

    doc.end();
    return done;
  }

  private money(value: number, currency: string): string {
    const formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
    if (currency === 'INR') return `${this.useRupee ? '₹' : 'Rs. '}${formatted}`;
    return `${currency} ${formatted}`;
  }

  private rows(doc: PDFDoc, top: number, title: string, rows: [string, string][]): number {
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(10.5).text(title, PAGE_LEFT, top);
    doc
      .moveTo(PAGE_LEFT, top + 15)
      .lineTo(PAGE_RIGHT, top + 15)
      .strokeColor(BORDER)
      .lineWidth(1)
      .stroke();
    let y = top + 22;
    rows.forEach((row) => {
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(row[0], PAGE_LEFT + 4, y, { width: 300 });
      doc
        .fillColor(TEXT)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(row[1], PAGE_RIGHT - 200, y, { width: 200, align: 'right' });
      y += 17;
    });
    return y + 12;
  }
}
