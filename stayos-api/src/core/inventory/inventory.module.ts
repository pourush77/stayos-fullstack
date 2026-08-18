import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from '../properties/properties.module';
import { RoomTypeInventoryEntity } from './infrastructure/room-type-inventory.entity';
import { AvailabilityService } from './availability.service';
import { InventoryReconciliationService } from './inventory-reconciliation.service';
import { InventoryReconciliationScheduler } from './inventory-reconciliation.scheduler';
import { InventoryController } from './inventory.controller';

/**
 * Phase 1C inventory foundation:
 *
 * - standalone availability engine
 * - read-only inventory reconciliation
 * - scheduled production drift monitoring
 *
 * AvailabilityService is consumed by the reservation lifecycle for
 * transactional consume/release.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RoomTypeInventoryEntity]), PropertiesModule],
  controllers: [InventoryController],
  providers: [
    AvailabilityService,
    InventoryReconciliationService,
    InventoryReconciliationScheduler,
  ],
  exports: [AvailabilityService, InventoryReconciliationService],
})
export class InventoryModule {}
