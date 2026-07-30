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
import { FloorEntity } from '../floors/infrastructure/floor.entity';
import { PropertiesService } from '../properties/properties.service';
import { RoomTypeEntity } from '../room-types/infrastructure/room-type.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomOperationalStatusNoteDto } from './dto/room-operational-status-note.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomOperationalStatus } from './domain/room-operational-status.enum';
import { RoomEntity } from './infrastructure/room.entity';

export interface PaginatedRooms {
  data: RoomEntity[];
  pagination?: PaginationMeta;
}

const roomSortColumns: Record<string, string> = {
  roomNumber: 'room.roomNumber',
  displayName: 'room.displayName',
  status: 'room.status',
  operationalStatus: 'room.operationalStatus',
  createdAt: 'room.createdAt',
};

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(FloorEntity)
    private readonly floorsRepository: Repository<FloorEntity>,
    @InjectRepository(RoomTypeEntity)
    private readonly roomTypesRepository: Repository<RoomTypeEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async findAll(propertyId: string, query: PaginationQueryDto): Promise<PaginatedRooms> {
    await this.propertiesService.findOne(propertyId);
    const sortColumn = this.resolveSortColumn(query.sortBy);
    const page = query.page;
    const limit = query.limit;
    const qb = this.roomsRepository
      .createQueryBuilder('room')
      .where('room.propertyId = :propertyId', { propertyId });

    if (query.search) {
      qb.andWhere('(room.roomNumber ILIKE :search OR room.displayName ILIKE :search)', {
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

  async findOne(propertyId: string, id: string): Promise<RoomEntity> {
    await this.propertiesService.findOne(propertyId);
    const room = await this.roomsRepository.findOne({
      where: { id, propertyId },
    });

    if (!room) {
      throw new NotFoundException(`Room ${id} was not found`);
    }

    return room;
  }

  async create(propertyId: string, createRoomDto: CreateRoomDto): Promise<RoomEntity> {
    await this.propertiesService.findOne(propertyId);
    await this.validateInventoryReferences(
      propertyId,
      createRoomDto.floorId,
      createRoomDto.roomTypeId,
    );

    try {
      const room = this.roomsRepository.create({
        ...createRoomDto,
        propertyId,
        displayName: createRoomDto.displayName ?? null,
        description: createRoomDto.description ?? null,
      });

      return await this.roomsRepository.save(room);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(propertyId: string, id: string, updateRoomDto: UpdateRoomDto): Promise<RoomEntity> {
    const room = await this.findOne(propertyId, id);
    await this.validateInventoryReferences(
      propertyId,
      updateRoomDto.floorId ?? room.floorId,
      updateRoomDto.roomTypeId ?? room.roomTypeId,
    );

    try {
      const updatedRoom = this.roomsRepository.merge(room, updateRoomDto);

      return await this.roomsRepository.save(updatedRoom);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async markReady(propertyId: string, id: string): Promise<RoomEntity> {
    return this.updateOperationalStatus(propertyId, id, RoomOperationalStatus.READY);
  }

  async markCleaning(propertyId: string, id: string): Promise<RoomEntity> {
    return this.updateOperationalStatus(propertyId, id, RoomOperationalStatus.NEEDS_CLEANING);
  }

  async markInspection(propertyId: string, id: string): Promise<RoomEntity> {
    return this.updateOperationalStatus(propertyId, id, RoomOperationalStatus.INSPECTION);
  }

  async block(
    propertyId: string,
    id: string,
    statusNoteDto: RoomOperationalStatusNoteDto = {},
  ): Promise<RoomEntity> {
    return this.updateOperationalStatus(
      propertyId,
      id,
      RoomOperationalStatus.OUT_OF_SERVICE,
      statusNoteDto,
    );
  }

  async markOutOfService(
    propertyId: string,
    id: string,
    statusNoteDto: RoomOperationalStatusNoteDto = {},
  ): Promise<RoomEntity> {
    return this.updateOperationalStatus(
      propertyId,
      id,
      RoomOperationalStatus.OUT_OF_SERVICE,
      statusNoteDto,
    );
  }

  async markOutOfOrder(
    propertyId: string,
    id: string,
    statusNoteDto: RoomOperationalStatusNoteDto = {},
  ): Promise<RoomEntity> {
    return this.updateOperationalStatus(
      propertyId,
      id,
      RoomOperationalStatus.OUT_OF_ORDER,
      statusNoteDto,
    );
  }

  async markMaintenance(
    propertyId: string,
    id: string,
    statusNoteDto: RoomOperationalStatusNoteDto = {},
  ): Promise<RoomEntity> {
    return this.updateOperationalStatus(
      propertyId,
      id,
      RoomOperationalStatus.MAINTENANCE,
      statusNoteDto,
    );
  }

  private async validateInventoryReferences(
    propertyId: string,
    floorId: string,
    roomTypeId: string,
  ): Promise<void> {
    const [floor, roomType] = await Promise.all([
      this.floorsRepository.findOne({ where: { id: floorId } }),
      this.roomTypesRepository.findOne({ where: { id: roomTypeId } }),
    ]);

    if (!floor) {
      throw new NotFoundException(`Floor ${floorId} was not found`);
    }

    if (!roomType) {
      throw new NotFoundException(`Room type ${roomTypeId} was not found`);
    }

    if (floor.propertyId !== propertyId || roomType.propertyId !== propertyId) {
      throw new BadRequestException('Room floor and room type must belong to the same property');
    }
  }

  private resolveSortColumn(sortBy = 'roomNumber'): string {
    const sortColumn = roomSortColumns[sortBy];

    if (!sortColumn) {
      throw new BadRequestException(`Unsupported room sort field: ${sortBy}`);
    }

    return sortColumn;
  }

  private async updateOperationalStatus(
    propertyId: string,
    id: string,
    operationalStatus: RoomOperationalStatus,
    statusNoteDto?: RoomOperationalStatusNoteDto,
  ): Promise<RoomEntity> {
    const room = await this.findOne(propertyId, id);
    const updatedRoom = this.roomsRepository.merge(room, {
      operationalStatus,
      operationalStatusReason: statusNoteDto?.reason ?? null,
      operationalStatusNote: statusNoteDto?.note ?? null,
    });

    return this.roomsRepository.save(updatedRoom);
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };

      if (driverError.code === '23505') {
        throw new ConflictException('Room number already exists for property');
      }
    }

    throw error;
  }
}
