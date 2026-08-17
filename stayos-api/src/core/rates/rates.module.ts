import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from '../properties/properties.module';
import { RoomTypesModule } from '../room-types/room-types.module';
import { ChildAgeBandEntity } from './infrastructure/child-age-band.entity';
import { GuestPricingPolicyEntity } from './infrastructure/guest-pricing-policy.entity';
import { PropertyTaxConfigEntity } from './infrastructure/property-tax-config.entity';
import { RatePlanEntity } from './infrastructure/rate-plan.entity';
import { RoomTypeDailyRateEntity } from './infrastructure/room-type-daily-rate.entity';
import { RatePlanRoomTypeEntity } from './infrastructure/rate-plan-room-type.entity';
import { ChildPricingService } from './child-pricing.service';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';
import { TaxService } from './tax.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RatePlanEntity,
      RoomTypeDailyRateEntity,
      RatePlanRoomTypeEntity,
      GuestPricingPolicyEntity,
      ChildAgeBandEntity,
      PropertyTaxConfigEntity,
    ]),
    PropertiesModule,
    RoomTypesModule,
  ],
  controllers: [RatesController],
  providers: [RatesService, ChildPricingService, TaxService],
  exports: [RatesService, ChildPricingService, TaxService],
})
export class RatesModule {}
