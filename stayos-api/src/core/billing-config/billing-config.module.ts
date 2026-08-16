import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from '../properties/properties.module';
import { BillingConfigController } from './billing-config.controller';
import { BillingConfigService } from './billing-config.service';
import { PropertyBillingConfigEntity } from './infrastructure/property-billing-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyBillingConfigEntity]), PropertiesModule],
  controllers: [BillingConfigController],
  providers: [BillingConfigService],
  exports: [BillingConfigService],
})
export class BillingConfigModule {}
