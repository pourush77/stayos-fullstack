import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyEntity } from '../properties/infrastructure/property.entity';
import { RatePlanEntity } from '../rates/infrastructure/rate-plan.entity';
import { PropertyPolicyEntity } from './infrastructure/property-policy.entity';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
import { PolicyResolverService } from './policy-resolver.service';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyPolicyEntity, RatePlanEntity, PropertyEntity])],
  controllers: [PoliciesController],
  providers: [PoliciesService, PolicyResolverService],
  exports: [PoliciesService, PolicyResolverService],
})
export class PoliciesModule {}
