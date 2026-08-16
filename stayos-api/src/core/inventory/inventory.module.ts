import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomTypeInventoryEntity } from './infrastructure/room-type-inventory.entity';
import { AvailabilityService } from './availability.service';
import { InventoryReconciliationService } from './inventory-reconciliation.service';

/**
 * Phase 1C-a1: inventory foundation. Provides the standalone availability
 * engine + reconciliation. Intentionally NOT wired into the reservation
 * lifecycle yet.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RoomTypeInventoryEntity])],
  providers: [AvailabilityService, InventoryReconciliationService],
  exports: [AvailabilityService, InventoryReconciliationService],
})
export class InventoryModule {}
