import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomTypeInventoryEntity } from './infrastructure/room-type-inventory.entity';
import { AvailabilityService } from './availability.service';
import { InventoryReconciliationService } from './inventory-reconciliation.service';
import { InventoryController } from './inventory.controller';

/**
 * Phase 1C inventory foundation: standalone availability engine +
 * reconciliation drift health-check (read-only endpoint). AvailabilityService
 * is consumed by the reservation lifecycle for transactional consume/release.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RoomTypeInventoryEntity])],
  controllers: [InventoryController],
  providers: [AvailabilityService, InventoryReconciliationService],
  exports: [AvailabilityService, InventoryReconciliationService],
})
export class InventoryModule {}
