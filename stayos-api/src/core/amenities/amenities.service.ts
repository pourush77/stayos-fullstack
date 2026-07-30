import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { CreateAmenityDto, UpdateAmenityDto } from './dto/amenity.dto';
import { AmenityEntity } from './infrastructure/amenity.entity';

@Injectable()
export class AmenitiesService {
  constructor(
    @InjectRepository(AmenityEntity)
    private readonly amenitiesRepository: Repository<AmenityEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async findAll(propertyId: string): Promise<AmenityEntity[]> {
    await this.propertiesService.findOne(propertyId);
    return this.amenitiesRepository.find({
      where: { propertyId },
      order: { category: 'ASC', label: 'ASC' },
    });
  }

  async findOne(propertyId: string, id: string): Promise<AmenityEntity> {
    await this.propertiesService.findOne(propertyId);
    const amenity = await this.amenitiesRepository.findOne({ where: { id, propertyId } });
    if (!amenity) throw new NotFoundException(`Amenity ${id} was not found`);
    return amenity;
  }

  async create(propertyId: string, dto: CreateAmenityDto): Promise<AmenityEntity> {
    await this.propertiesService.findOne(propertyId);
    try {
      return await this.amenitiesRepository.save(this.amenitiesRepository.create({
        propertyId,
        code: this.normalizeCode(dto.code),
        label: dto.label.trim(),
        category: dto.category,
        isActive: dto.isActive ?? true,
      }));
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(propertyId: string, id: string, dto: UpdateAmenityDto): Promise<AmenityEntity> {
    const amenity = await this.findOne(propertyId, id);
    const updated = this.amenitiesRepository.merge(amenity, {
      ...(dto.code !== undefined ? { code: this.normalizeCode(dto.code) } : {}),
      ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
    try {
      return await this.amenitiesRepository.save(updated);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async remove(propertyId: string, id: string): Promise<void> {
    const amenity = await this.findOne(propertyId, id);
    await this.amenitiesRepository.remove(amenity);
  }

  async findActiveByIds(propertyId: string, amenityIds: string[]): Promise<AmenityEntity[]> {
    if (amenityIds.length === 0) return [];
    const uniqueIds = Array.from(new Set(amenityIds));
    const amenities = await this.amenitiesRepository.find({
      where: { id: In(uniqueIds), propertyId, isActive: true },
    });
    if (amenities.length !== uniqueIds.length) {
      throw new BadRequestException('All amenities must exist, be active, and belong to the same property');
    }
    return amenities;
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, '-');
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };
      if (driverError.code === '23505') throw new ConflictException('Amenity code already exists for property');
    }
    throw error;
  }
}
