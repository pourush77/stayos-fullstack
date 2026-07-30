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
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyEntity } from './infrastructure/property.entity';

export interface PaginatedProperties {
  data: PropertyEntity[];
  pagination?: PaginationMeta;
}

const propertySortColumns: Record<string, string> = {
  code: 'property.code',
  name: 'property.name',
  city: 'property.city',
  status: 'property.status',
  createdAt: 'property.createdAt',
};

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(PropertyEntity)
    private readonly propertiesRepository: Repository<PropertyEntity>,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<PaginatedProperties> {
    const sortColumn = this.resolveSortColumn(query.sortBy);
    const page = query.page;
    const limit = query.limit;
    const qb = this.propertiesRepository.createQueryBuilder('property');

    if (query.search) {
      qb.where(
        '(property.code ILIKE :search OR property.name ILIKE :search OR property.city ILIKE :search)',
        { search: `%${query.search}%` },
      );
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

  async findOne(id: string): Promise<PropertyEntity> {
    const property = await this.propertiesRepository.findOne({ where: { id } });

    if (!property) {
      throw new NotFoundException(`Property ${id} was not found`);
    }

    return property;
  }

  async create(createPropertyDto: CreatePropertyDto): Promise<PropertyEntity> {
    try {
      const property = this.propertiesRepository.create({
        ...createPropertyDto,
        panNumber: createPropertyDto.panNumber ?? null,
        cinNumber: createPropertyDto.cinNumber ?? null,
        logoUrl: createPropertyDto.logoUrl ?? null,
        website: createPropertyDto.website ?? null,
        addressLine2: createPropertyDto.addressLine2 ?? null,
      });

      return await this.propertiesRepository.save(property);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto): Promise<PropertyEntity> {
    const property = await this.findOne(id);

    try {
      const updatedProperty = this.propertiesRepository.merge(property, updatePropertyDto);

      return await this.propertiesRepository.save(updatedProperty);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };

      if (driverError.code === '23505') {
        throw new ConflictException('Property code already exists');
      }
    }

    throw error;
  }

  private resolveSortColumn(sortBy = 'name'): string {
    const sortColumn = propertySortColumns[sortBy];

    if (!sortColumn) {
      throw new BadRequestException(`Unsupported property sort field: ${sortBy}`);
    }

    return sortColumn;
  }
}
