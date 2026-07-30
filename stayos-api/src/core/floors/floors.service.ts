import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  createPaginationMeta,
  PaginationMeta,
  PaginationQueryDto,
  paginateQuery,
} from '../../common/dto/pagination.dto';
import { PropertiesService } from '../properties/properties.service';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { FloorEntity } from './infrastructure/floor.entity';

export interface PaginatedFloors {
  data: FloorEntity[];
  pagination?: PaginationMeta;
}

const floorSortColumns: Record<string, string> = {
  code: 'floor.code',
  name: 'floor.name',
  floorNumber: 'floor.floorNumber',
  displayOrder: 'floor.displayOrder',
  status: 'floor.status',
  createdAt: 'floor.createdAt',
};

@Injectable()
export class FloorsService {
  constructor(
    @InjectRepository(FloorEntity)
    private readonly floorsRepository: Repository<FloorEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async findAll(propertyId: string, query: PaginationQueryDto): Promise<PaginatedFloors> {
    await this.propertiesService.findOne(propertyId);
    const sortColumn = this.resolveSortColumn(query.sortBy);
    const page = query.page;
    const limit = query.limit;
    const qb = this.floorsRepository
      .createQueryBuilder('floor')
      .where('floor.propertyId = :propertyId', { propertyId });

    if (query.search) {
      qb.andWhere('(floor.code ILIKE :search OR floor.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const pagination = paginateQuery(page, limit);

    if (!pagination) {
      const data = await qb.orderBy(sortColumn, query.sortOrder).getMany();

      return { data };
    }

    const [data, total] = await qb
      .orderBy(sortColumn, query.sortOrder)
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit)
      .getManyAndCount();

    return {
      data,
      pagination: createPaginationMeta(pagination.page, pagination.limit, total),
    };
  }

  async findOne(propertyId: string, id: string): Promise<FloorEntity> {
    await this.propertiesService.findOne(propertyId);
    const floor = await this.floorsRepository.findOne({
      where: { id, propertyId },
    });

    if (!floor) {
      throw new NotFoundException(`Floor ${id} was not found`);
    }

    return floor;
  }

  async create(propertyId: string, createFloorDto: CreateFloorDto): Promise<FloorEntity> {
    await this.propertiesService.findOne(propertyId);

    try {
      const floor = this.floorsRepository.create({
        ...createFloorDto,
        propertyId,
        displayOrder: createFloorDto.displayOrder ?? 0,
        description: createFloorDto.description ?? null,
      });

      return await this.floorsRepository.save(floor);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(
    propertyId: string,
    id: string,
    updateFloorDto: UpdateFloorDto,
  ): Promise<FloorEntity> {
    const floor = await this.findOne(propertyId, id);

    try {
      const updatedFloor = this.floorsRepository.merge(floor, updateFloorDto);

      return await this.floorsRepository.save(updatedFloor);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  private resolveSortColumn(sortBy = 'displayOrder'): string {
    const sortColumn = floorSortColumns[sortBy];

    if (!sortColumn) {
      throw new BadRequestException(`Unsupported floor sort field: ${sortBy}`);
    }

    return sortColumn;
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string; constraint?: string };

      if (driverError.code === '23505') {
        if (driverError.constraint === 'UQ_floors_property_floor_number') {
          throw new ConflictException('Floor number already exists for property');
        }

        throw new ConflictException('Floor code already exists for property');
      }
    }

    throw error;
  }
}
