import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from '../properties/properties.module';
import { RoomTypesModule } from '../room-types/room-types.module';
import { PoliciesModule } from '../policies/policies.module';
import { ChildAgeBandEntity } from './infrastructure/child-age-band.entity';
import { GuestPricingPolicyEntity } from './infrastructure/guest-pricing-policy.entity';
import { PropertyTaxConfigEntity } from './infrastructure/property-tax-config.entity';
import { RatePlanEntity } from './infrastructure/rate-plan.entity';
import { RoomTypeDailyRateEntity } from './infrastructure/room-type-daily-rate.entity';
import { RatePlanRoomTypeEntity } from './infrastructure/rate-plan-room-type.entity';
import { RateRestrictionEntity } from './infrastructure/rate-restriction.entity';
import { ChildPricingService } from './child-pricing.service';
import { RateResolverService } from './rate-resolver.service';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';
import { RestrictionService } from './restriction.service';
import { TaxService } from './tax.service';
import { GstService } from './gst.service';
import { TaxRuleEntity } from './infrastructure/tax-rule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RatePlanEntity,
      RoomTypeDailyRateEntity,
      RatePlanRoomTypeEntity,
      GuestPricingPolicyEntity,
      ChildAgeBandEntity,
      PropertyTaxConfigEntity,
      RateRestrictionEntity,
      TaxRuleEntity,
    ]),
    PropertiesModule,
    RoomTypesModule,
    PoliciesModule,
  ],
  controllers: [RatesController],
  providers: [RatesService, ChildPricingService, TaxService, GstService, RateResolverService, RestrictionService],
  exports: [RatesService, ChildPricingService, TaxService, GstService, RateResolverService, RestrictionService],
})
export class RatesModule {}
