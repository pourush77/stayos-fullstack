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
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { RoomTypeEntity } from './infrastructure/room-type.entity';

export interface PaginatedRoomTypes {
  data: RoomTypeEntity[];
  pagination?: PaginationMeta;
}

const roomTypeSortColumns: Record<string, string> = {
  code: 'roomType.code',
  name: 'roomType.name',
  baseOccupancy: 'roomType.baseOccupancy',
  maxOccupancy: 'roomType.maxOccupancy',
  status: 'roomType.status',
  createdAt: 'roomType.createdAt',
};

@Injectable()
export class RoomTypesService {
  constructor(
    @InjectRepository(RoomTypeEntity)
    private readonly roomTypesRepository: Repository<RoomTypeEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async findAll(propertyId: string, query: PaginationQueryDto): Promise<PaginatedRoomTypes> {
    await this.propertiesService.findOne(propertyId);
    const sortColumn = this.resolveSortColumn(query.sortBy);
    const page = query.page;
    const limit = query.limit;
    const qb = this.roomTypesRepository
      .createQueryBuilder('roomType')
      .where('roomType.propertyId = :propertyId', { propertyId });

    if (query.search) {
      qb.andWhere('(roomType.code ILIKE :search OR roomType.name ILIKE :search)', {
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

  async findOne(propertyId: string, id: string): Promise<RoomTypeEntity> {
    await this.propertiesService.findOne(propertyId);
    const roomType = await this.roomTypesRepository.findOne({
      where: { id, propertyId },
    });

    if (!roomType) {
      throw new NotFoundException(`Room type ${id} was not found`);
    }

    return roomType;
  }

  async create(propertyId: string, createRoomTypeDto: CreateRoomTypeDto): Promise<RoomTypeEntity> {
    await this.propertiesService.findOne(propertyId);
    this.validateOccupancy(createRoomTypeDto);

    try {
      const roomType = this.roomTypesRepository.create({
        ...createRoomTypeDto,
        propertyId,
        description: createRoomTypeDto.description ?? null,
        bedType: createRoomTypeDto.bedType ?? null,
        sizeSqFt: createRoomTypeDto.sizeSqFt ?? null,
      });

      return await this.roomTypesRepository.save(roomType);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(
    propertyId: string,
    id: string,
    updateRoomTypeDto: UpdateRoomTypeDto,
  ): Promise<RoomTypeEntity> {
    const roomType = await this.findOne(propertyId, id);
    this.validateOccupancy({ ...roomType, ...updateRoomTypeDto });

    try {
      const updatedRoomType = this.roomTypesRepository.merge(roomType, updateRoomTypeDto);

      return await this.roomTypesRepository.save(updatedRoomType);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  private validateOccupancy(values: { baseOccupancy: number; maxOccupancy: number }): void {
    if (values.maxOccupancy < values.baseOccupancy) {
      throw new BadRequestException('maxOccupancy must be greater than or equal to baseOccupancy');
    }
  }

  private resolveSortColumn(sortBy = 'name'): string {
    const sortColumn = roomTypeSortColumns[sortBy];

    if (!sortColumn) {
      throw new BadRequestException(`Unsupported room type sort field: ${sortBy}`);
    }

    return sortColumn;
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };

      if (driverError.code === '23505') {
        throw new ConflictException('Room type code already exists for property');
      }
    }

    throw error;
  }
}
