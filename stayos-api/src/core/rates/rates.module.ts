import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from '../properties/properties.module';
import { RoomTypesModule } from '../room-types/room-types.module';
import { RatePlanEntity } from './infrastructure/rate-plan.entity';
import { RoomTypeDailyRateEntity } from './infrastructure/room-type-daily-rate.entity';
import { RatesService } from './rates.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RatePlanEntity, RoomTypeDailyRateEntity]),
    PropertiesModule,
    RoomTypesModule,
  ],
  providers: [RatesService],
  exports: [RatesService],
})
export class RatesModule {}
