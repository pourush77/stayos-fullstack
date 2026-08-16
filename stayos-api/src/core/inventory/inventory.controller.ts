import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { InventoryReconciliationService } from './inventory-reconciliation.service';

/**
 * Read-only inventory drift health-check. It NEVER mutates or auto-corrects
 * inventory — it recomputes the expected ledger from live reservations + rooms
 * and reports any drift (MISSING_ROW / ORPHAN_SOLD / SOLD_MISMATCH /
 * CAPACITY_MISMATCH / OVERSELL) for operators to act on.
 */
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('properties/:propertyId/inventory')
export class InventoryController {
  constructor(private readonly reconciliationService: InventoryReconciliationService) {}

  @Get('reconciliation')
  @RequirePermissions(Permissions.OperationsView)
  @ApiOperation({ summary: 'Inventory drift health-check (read-only, never mutates)' })
  async reconcile(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    const result = await this.reconciliationService.reconcile(propertyId);
    return {
      success: true,
      message: result.consistent
        ? 'Inventory is consistent.'
        : 'Inventory drift detected.',
      data: {
        consistent: result.consistent,
        countsByType: result.countsByType,
        discrepancies: result.discrepancies,
      },
    };
  }
}
