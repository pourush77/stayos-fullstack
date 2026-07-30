import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ActivityEventEntity } from '../../activity/infrastructure/activity-event.entity';
import { PropertiesService } from '../../properties/properties.service';
import { ActivityFeedItemDto, ActivityFeedQueryDto } from '../dto/operations.dto';
import { OperationsMapper } from '../mappers/operations.mapper';

@Injectable()
export class ActivityFeedService {
  constructor(
    @InjectRepository(ActivityEventEntity)
    private readonly activityRepository: Repository<ActivityEventEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async getActivityFeed(
    propertyId: string,
    query: ActivityFeedQueryDto,
  ): Promise<ActivityFeedItemDto[]> {
    await this.propertiesService.findOne(propertyId);
    const where: FindOptionsWhere<ActivityEventEntity> = { propertyId };

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.type) {
      where.type = query.type;
    }

    const activities = await this.activityRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit ?? 20,
    });

    return activities.map(OperationsMapper.toActivityFeedItem);
  }
}
