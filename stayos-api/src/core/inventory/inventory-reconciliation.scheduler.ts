import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PropertiesService } from '../properties/properties.service';
import { PropertyStatus } from '../properties/domain/property-status.enum';
import { InventoryReconciliationService } from './inventory-reconciliation.service';

/**
 * P0-5 production inventory drift monitor.
 *
 * Reconciliation is deliberately READ-ONLY.
 *
 * This scheduler:
 * - checks every ACTIVE property
 * - runs once per hour
 * - logs inventory discrepancies
 * - logs reconciliation failures
 * - NEVER mutates or repairs inventory
 *
 * Inventory repair must remain an explicit operational action.
 */
@Injectable()
export class InventoryReconciliationScheduler {
  private readonly logger = new Logger(InventoryReconciliationScheduler.name);

  private running = false;

  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly reconciliationService: InventoryReconciliationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async reconcileInventory(): Promise<void> {
    // Prevent overlapping executions if reconciliation ever takes
    // longer than the scheduler interval.
    if (this.running) {
      this.logger.warn('Inventory reconciliation skipped because the previous run is still active');
      return;
    }

    this.running = true;

    try {
      const { data: properties } = await this.propertiesService.findAll({
        sortOrder: 'ASC',
      });

      const activeProperties = properties.filter(
        (property) => property.status === PropertyStatus.ACTIVE,
      );

      this.logger.log(
        `Running inventory reconciliation for ${activeProperties.length} active properties`,
      );

      for (const property of activeProperties) {
        try {
          const result = await this.reconciliationService.reconcile(property.id);

          if (!result.consistent) {
            this.logger.error({
              event: 'INVENTORY_RECONCILIATION_DRIFT',
              propertyId: property.id,
              propertyCode: property.code,
              discrepancies: result.discrepancies,
              countsByType: result.countsByType,
            });
          }
        } catch (error) {
          this.logger.error({
            event: 'INVENTORY_RECONCILIATION_FAILED',
            propertyId: property.id,
            propertyCode: property.code,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      this.logger.error({
        event: 'INVENTORY_RECONCILIATION_SCHEDULER_FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }
}
