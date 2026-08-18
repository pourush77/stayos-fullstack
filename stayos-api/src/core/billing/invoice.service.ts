import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { BusinessDateService } from '../properties/services/business-date.service';
import { FolioEntity } from './infrastructure/folio.entity';
import { InvoiceEntity } from './infrastructure/invoice.entity';
import { InvoiceType } from './domain/invoice-type.enum';
import { InvoiceStatus } from './domain/invoice-status.enum';
import { PropertyBillingConfigEntity } from '../billing-config/infrastructure/property-billing-config.entity';
import { buildInvoiceNumber, financialYearLabel } from '../billing-config/invoice-number';
import {
  buildInvoiceSnapshot,
  negateInvoiceSnapshot,
  InvoiceSnapshot,
  InvoiceSnapshotError,
} from './invoice-snapshot';
import { toCents } from './domain/money';

const FOLIO_RELATIONS = {
  property: true,
  guest: true,
  reservation: { room: true },
  charges: true,
  payments: true,
} as const;

const BILLING_DEFAULTS = {
  invoicePrefix: 'INV-',
  resetSequenceYearly: true,
  financialYearStartMonth: 4,
};

/**
 * Phase 1D-e invoice engine. Finalizes an immutable GST tax invoice from the
 * FROZEN folio ledger (never recalculates prices/taxes), with property-scoped,
 * FY-aware, concurrency-safe numbering and idempotent finalization. Corrections
 * after finalization go through an auditable, linked credit note.
 *
 * Invoice financial-year allocation is derived from the property's operational
 * business date, not the server/runtime UTC date.
 */
@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoicesRepository: Repository<InvoiceEntity>,
    @InjectRepository(FolioEntity)
    private readonly foliosRepository: Repository<FolioEntity>,
    @InjectRepository(PropertyBillingConfigEntity)
    private readonly billingConfigsRepository: Repository<PropertyBillingConfigEntity>,
    private readonly propertiesService: PropertiesService,
    private readonly businessDateService: BusinessDateService,
    private readonly dataSource: DataSource,
  ) {}

  /** Read-only draft/preview built from current frozen state; nothing persisted. */
  async previewInvoice(propertyId: string, folioId: string): Promise<InvoiceSnapshot> {
    await this.propertiesService.findOne(propertyId);

    const folio = await this.foliosRepository.findOne({
      where: { id: folioId, propertyId },
      relations: FOLIO_RELATIONS,
    });

    if (!folio) {
      throw new NotFoundException(`Folio ${folioId} was not found`);
    }

    try {
      return buildInvoiceSnapshot(folio);
    } catch (error) {
      if (error instanceof InvoiceSnapshotError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  async getInvoice(propertyId: string, invoiceId: string): Promise<InvoiceEntity> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id: invoiceId, propertyId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} was not found`);
    }

    return invoice;
  }

  async listForFolio(propertyId: string, folioId: string): Promise<InvoiceEntity[]> {
    await this.propertiesService.findOne(propertyId);

    return this.invoicesRepository.find({
      where: { propertyId, folioId },
      order: { createdAt: 'ASC' },
    });
  }

  async finalizeInvoice(
    propertyId: string,
    folioId: string,
    idempotencyKey?: string | null,
    actorUserId?: string | null,
  ): Promise<InvoiceEntity> {
    await this.propertiesService.findOne(propertyId);

    return this.dataSource.transaction((manager) =>
      this.finalizeInvoiceOnManager(manager, propertyId, folioId, idempotencyKey, actorUserId),
    );
  }

  /**
   * Manager-threaded finalize (reused by checkout so there is no nested
   * transaction). Locks the folio row, requires an EXACTLY zero balance, and is
   * idempotent: at most one non-void TAX_INVOICE exists per folio.
   */
  async finalizeInvoiceOnManager(
    manager: EntityManager,
    propertyId: string,
    folioId: string,
    idempotencyKey?: string | null,
    actorUserId?: string | null,
  ): Promise<InvoiceEntity> {
    const invoiceRepo = manager.getRepository(InvoiceEntity);

    // Lock the folio row to serialize concurrent finalize attempts.
    const lockedFolio = await manager.getRepository(FolioEntity).findOne({
      where: { id: folioId, propertyId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!lockedFolio) {
      throw new NotFoundException(`Folio ${folioId} was not found`);
    }

    const existing = await invoiceRepo.find({
      where: {
        folioId,
        type: InvoiceType.TAX_INVOICE,
      },
    });

    const active = existing.find((invoice) => invoice.status !== InvoiceStatus.VOID);

    if (active && active.status === InvoiceStatus.FINALIZED) {
      return active;
    }

    const folio = await manager.getRepository(FolioEntity).findOne({
      where: { id: folioId, propertyId },
      relations: FOLIO_RELATIONS,
    });

    const snapshot = this.buildSnapshotOrThrow(folio!);

    if (snapshot.lines.length === 0) {
      throw new BadRequestException('Cannot finalize an invoice with no charges');
    }

    if (toCents(snapshot.totals.balance) !== 0) {
      throw new BadRequestException(
        'Invoice can only be finalized on a settled, zero-balance folio',
      );
    }

    const config = await this.loadConfig(manager, propertyId);

    /**
     * IMPORTANT:
     * Invoice/FY numbering must follow the property's operational business date,
     * not the Node/server UTC date.
     *
     * The folio relation already contains the property including:
     * - timezone
     * - businessDayCutOffTime
     */
    const businessDate = this.businessDateService.resolveForProperty(folio!.property);

    const fyLabel = config.resetSequenceYearly
      ? financialYearLabel(businessDate, config.financialYearStartMonth)
      : '';

    const seq = await this.allocateNumber(manager, propertyId, 'INVOICE', fyLabel);

    const invoiceNumber = buildInvoiceNumber(config.invoicePrefix, seq, {
      financialYearLabel: fyLabel || undefined,
    });

    const invoice = active ?? invoiceRepo.create();

    Object.assign(invoice, {
      propertyId,
      folioId,
      reservationId: folio!.reservationId,
      guestId: folio!.guestId,
      type: InvoiceType.TAX_INVOICE,
      status: InvoiceStatus.FINALIZED,
      invoiceNumber,
      fyLabel: fyLabel || null,
      currency: snapshot.currency,
      placeOfSupply: snapshot.placeOfSupply,
      grandTotal: snapshot.totals.grandTotal,
      seller: snapshot.seller,
      buyer: snapshot.buyer,
      reservation: snapshot.reservation,
      lines: snapshot.lines,
      totals: snapshot.totals,
      payments: snapshot.payments,
      settledAt: folio!.settledAt ?? null,
      idempotencyKey: idempotencyKey ?? null,
      createdByUserId: actorUserId ?? null,
      issuedAt: new Date(),
    });

    try {
      return await invoiceRepo.save(invoice);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const current = await invoiceRepo.findOne({
          where: {
            folioId,
            type: InvoiceType.TAX_INVOICE,
            status: InvoiceStatus.FINALIZED,
          },
        });

        if (current) {
          return current;
        }
      }

      throw error;
    }
  }

  async issueCreditNote(
    propertyId: string,
    invoiceId: string,
    reason: string,
    actorUserId?: string | null,
  ): Promise<InvoiceEntity> {
    const property = await this.propertiesService.findOne(propertyId);

    return this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(InvoiceEntity);

      const original = await invoiceRepo.findOne({
        where: { id: invoiceId, propertyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!original) {
        throw new NotFoundException(`Invoice ${invoiceId} was not found`);
      }

      if (
        original.type !== InvoiceType.TAX_INVOICE ||
        original.status !== InvoiceStatus.FINALIZED
      ) {
        throw new BadRequestException(
          'Credit notes can only be issued against a finalized tax invoice',
        );
      }

      // Idempotent: one active credit note per original (full reversal).
      const existingNote = await invoiceRepo.findOne({
        where: {
          originalInvoiceId: original.id,
          type: InvoiceType.CREDIT_NOTE,
          status: InvoiceStatus.FINALIZED,
        },
      });

      if (existingNote) {
        return existingNote;
      }

      const config = await this.loadConfig(manager, propertyId);

      /**
       * Credit notes use the same property-business-date rule as tax invoices.
       * This prevents FY numbering from depending on the server timezone.
       */
      const businessDate = this.businessDateService.resolveForProperty(property);

      const fyLabel = config.resetSequenceYearly
        ? financialYearLabel(businessDate, config.financialYearStartMonth)
        : '';

      const seq = await this.allocateNumber(manager, propertyId, 'CREDIT_NOTE', fyLabel);

      const number = buildInvoiceNumber('CN-', seq, {
        financialYearLabel: fyLabel || undefined,
      });

      const reversed = negateInvoiceSnapshot({
        currency: original.currency,
        placeOfSupply: original.placeOfSupply ?? 'INTRA_STATE',
        seller: original.seller,
        buyer: original.buyer,
        reservation: original.reservation,
        lines: original.lines,
        totals: original.totals,
        payments: original.payments,
        settledAt: original.settledAt ? new Date(original.settledAt).toISOString() : null,
      });

      const creditNote = invoiceRepo.create({
        propertyId,
        folioId: original.folioId,
        reservationId: original.reservationId,
        guestId: original.guestId,
        type: InvoiceType.CREDIT_NOTE,
        status: InvoiceStatus.FINALIZED,
        invoiceNumber: number,
        fyLabel: fyLabel || null,
        currency: original.currency,
        placeOfSupply: original.placeOfSupply,
        grandTotal: reversed.totals.grandTotal,
        seller: reversed.seller,
        buyer: reversed.buyer,
        reservation: reversed.reservation,
        lines: reversed.lines,
        totals: reversed.totals,
        payments: [],
        settledAt: null,
        originalInvoiceId: original.id,
        voidReason: reason,
        createdByUserId: actorUserId ?? null,
        issuedAt: new Date(),
      });

      return invoiceRepo.save(creditNote);
    });
  }

  async voidDraftInvoice(
    propertyId: string,
    invoiceId: string,
    reason: string,
  ): Promise<InvoiceEntity> {
    await this.propertiesService.findOne(propertyId);

    return this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(InvoiceEntity);

      const invoice = await invoiceRepo.findOne({
        where: { id: invoiceId, propertyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} was not found`);
      }

      if (invoice.status === InvoiceStatus.FINALIZED) {
        throw new ConflictException(
          'A finalized invoice is immutable; issue a credit note to correct it',
        );
      }

      invoice.status = InvoiceStatus.VOID;
      invoice.voidReason = reason;

      return invoiceRepo.save(invoice);
    });
  }

  private buildSnapshotOrThrow(folio: FolioEntity): InvoiceSnapshot {
    try {
      return buildInvoiceSnapshot(folio);
    } catch (error) {
      if (error instanceof InvoiceSnapshotError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private async loadConfig(manager: EntityManager, propertyId: string) {
    const config = await manager.getRepository(PropertyBillingConfigEntity).findOne({
      where: { propertyId },
    });

    return {
      invoicePrefix: config?.invoicePrefix ?? BILLING_DEFAULTS.invoicePrefix,

      resetSequenceYearly: config?.resetSequenceYearly ?? BILLING_DEFAULTS.resetSequenceYearly,

      financialYearStartMonth:
        config?.financialYearStartMonth ?? BILLING_DEFAULTS.financialYearStartMonth,
    };
  }

  /** Atomic per (property, series, fy) counter — never count()+1. */
  private async allocateNumber(
    manager: EntityManager,
    propertyId: string,
    series: string,
    fyLabel: string,
  ): Promise<number> {
    const rows: Array<{ last_value: string | number }> = await manager.query(
      `INSERT INTO invoice_number_counters (property_id, series, fy_label, last_value)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (property_id, series, fy_label)
         DO UPDATE SET
           last_value = invoice_number_counters.last_value + 1,
           updated_at = now()
         RETURNING last_value`,
      [propertyId, series, fyLabel],
    );

    return Number(rows[0].last_value);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === '23505';
  }
}
