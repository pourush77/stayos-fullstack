import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PoliciesModule } from '../policies/policies.module';
import { PropertyEntity } from './infrastructure/property.entity';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { BusinessDateService } from './services/business-date.service';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyEntity]), PoliciesModule],
  controllers: [PropertiesController],
  providers: [PropertiesService, BusinessDateService],
  exports: [PropertiesService, BusinessDateService],
})
export class PropertiesModule {}
