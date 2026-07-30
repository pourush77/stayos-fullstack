import dataSource from '../src/database/data-source';
import { createPaginationMeta } from '../src/common/dto/pagination.dto';
import { FloorStatus } from '../src/core/floors/domain/floor-status.enum';
import { FloorEntity } from '../src/core/floors/infrastructure/floor.entity';
import { PropertyStatus } from '../src/core/properties/domain/property-status.enum';
import { PropertyEntity } from '../src/core/properties/infrastructure/property.entity';
import { RoomTypeStatus } from '../src/core/room-types/domain/room-type-status.enum';
import { RoomTypeEntity } from '../src/core/room-types/infrastructure/room-type.entity';
import { RoomOperationalStatus } from '../src/core/rooms/domain/room-operational-status.enum';
import { RoomStatus } from '../src/core/rooms/domain/room-status.enum';
import { RoomEntity } from '../src/core/rooms/infrastructure/room.entity';
import { EntityManager, Repository } from 'typeorm';

export const HILLSTON_PROPERTY_CODE = 'HILLSTON_IND';

type MutationAction = 'created' | 'updated';

interface MutationSummary {
  created: number;
  updated: number;
}

interface BootstrapSummary {
  property: MutationAction;
  floors: MutationSummary;
  roomTypes: MutationSummary;
  amenities: MutationSummary & { skipped: boolean; todo: string };
  rooms: MutationSummary;
}

interface InventorySummary {
  properties: number;
  guestFloors: number;
  roomTypes: number;
  rooms: number;
  deluxeRooms: number;
  suiteRooms: number;
}

interface HillstonFloorSeed {
  code: string;
  name: string;
  floorNumber: number;
  displayOrder: number;
}

interface HillstonRoomTypeSeed {
  code: string;
  name: string;
  description: string;
  bedType: string;
  baseOccupancy: number;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  sizeSqFt: number;
}

interface HillstonRoomSeed {
  roomNumber: string;
  floorCode: string;
  roomTypeCode: string;
}

export const hillstonBootstrapData = {
  property: {
    code: HILLSTON_PROPERTY_CODE,
    name: 'Hillston Resort & Club',
    legalName: 'Oyster Clubs and Resorts Pvt. Ltd.',
    gstNumber: '23AABCO9368D1ZG',
    phone: '9826388222',
    email: 'oystergroupcompany@gmail.com',
    addressLine1: 'Survey No. 199 & 201',
    addressLine2: 'Ralamandal',
    city: 'Indore',
    state: 'Madhya Pradesh',
    stateCode: '23',
    country: 'India',
    postalCode: '452020',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    totalFloors: 2,
    totalRooms: 24,
    status: PropertyStatus.ACTIVE,
  },
  floors: [
    {
      code: 'SECOND',
      name: 'Second Floor',
      floorNumber: 2,
      displayOrder: 1,
    },
    {
      code: 'THIRD',
      name: 'Third Floor',
      floorNumber: 3,
      displayOrder: 2,
    },
  ] satisfies HillstonFloorSeed[],
  roomTypes: [
    {
      code: 'DLX',
      name: 'Deluxe',
      description: 'King bed, breakfast included, non smoking, extra bed available, no balcony.',
      bedType: 'King',
      baseOccupancy: 2,
      maxOccupancy: 3,
      maxAdults: 2,
      maxChildren: 1,
      sizeSqFt: 251,
    },
    {
      code: 'STE',
      name: 'Suite',
      description: 'King bed, breakfast included, non smoking, extra bed available, no balcony.',
      bedType: 'King',
      baseOccupancy: 2,
      maxOccupancy: 4,
      maxAdults: 2,
      maxChildren: 2,
      sizeSqFt: 523,
    },
  ] satisfies HillstonRoomTypeSeed[],
  rooms: [
    ...['201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '214'].map(
      (roomNumber) => ({
        roomNumber,
        floorCode: 'SECOND',
        roomTypeCode: 'DLX',
      }),
    ),
    { roomNumber: '212', floorCode: 'SECOND', roomTypeCode: 'STE' },
    ...['301', '302', '304', '305', '306', '307', '308', '311'].map((roomNumber) => ({
      roomNumber,
      floorCode: 'THIRD',
      roomTypeCode: 'DLX',
    })),
    ...['303', '309', '310'].map((roomNumber) => ({
      roomNumber,
      floorCode: 'THIRD',
      roomTypeCode: 'STE',
    })),
  ] satisfies HillstonRoomSeed[],
  amenitiesTodo:
    'Amenity and RoomTypeAmenity entities are not implemented yet. Seed master amenities after the amenities module exists.',
};

export const expectedHillstonInventory: InventorySummary = {
  properties: 1,
  guestFloors: 2,
  roomTypes: 2,
  rooms: 24,
  deluxeRooms: 20,
  suiteRooms: 4,
};

interface SimulationState {
  properties: string[];
  floors: Array<{ propertyCode: string; code: string }>;
  roomTypes: Array<{ propertyCode: string; code: string }>;
  rooms: Array<{ propertyCode: string; roomNumber: string; roomTypeCode: string }>;
}

export const createHillstonSimulationState = (): SimulationState => ({
  properties: [],
  floors: [],
  roomTypes: [],
  rooms: [],
});

export const simulateHillstonBootstrap = (state: SimulationState): InventorySummary => {
  if (!state.properties.includes(HILLSTON_PROPERTY_CODE)) {
    state.properties.push(HILLSTON_PROPERTY_CODE);
  }

  hillstonBootstrapData.floors.forEach((floor) => {
    if (
      !state.floors.some(
        (existing) =>
          existing.propertyCode === HILLSTON_PROPERTY_CODE && existing.code === floor.code,
      )
    ) {
      state.floors.push({
        propertyCode: HILLSTON_PROPERTY_CODE,
        code: floor.code,
      });
    }
  });

  hillstonBootstrapData.roomTypes.forEach((roomType) => {
    if (
      !state.roomTypes.some(
        (existing) =>
          existing.propertyCode === HILLSTON_PROPERTY_CODE && existing.code === roomType.code,
      )
    ) {
      state.roomTypes.push({
        propertyCode: HILLSTON_PROPERTY_CODE,
        code: roomType.code,
      });
    }
  });

  hillstonBootstrapData.rooms.forEach((room) => {
    const existing = state.rooms.find(
      (candidate) =>
        candidate.propertyCode === HILLSTON_PROPERTY_CODE &&
        candidate.roomNumber === room.roomNumber,
    );

    if (existing) {
      existing.roomTypeCode = room.roomTypeCode;
      return;
    }

    state.rooms.push({
      propertyCode: HILLSTON_PROPERTY_CODE,
      roomNumber: room.roomNumber,
      roomTypeCode: room.roomTypeCode,
    });
  });

  return {
    properties: state.properties.filter((code) => code === HILLSTON_PROPERTY_CODE).length,
    guestFloors: state.floors.filter((floor) => floor.propertyCode === HILLSTON_PROPERTY_CODE)
      .length,
    roomTypes: state.roomTypes.filter(
      (roomType) => roomType.propertyCode === HILLSTON_PROPERTY_CODE,
    ).length,
    rooms: state.rooms.filter((room) => room.propertyCode === HILLSTON_PROPERTY_CODE).length,
    deluxeRooms: state.rooms.filter(
      (room) => room.propertyCode === HILLSTON_PROPERTY_CODE && room.roomTypeCode === 'DLX',
    ).length,
    suiteRooms: state.rooms.filter(
      (room) => room.propertyCode === HILLSTON_PROPERTY_CODE && room.roomTypeCode === 'STE',
    ).length,
  };
};

export const runHillstonBootstrap = async (): Promise<{
  summary: BootstrapSummary;
  inventory: InventorySummary;
}> => {
  await dataSource.initialize();

  try {
    return await dataSource.transaction(async (manager) => bootstrapHillston(manager));
  } finally {
    await dataSource.destroy();
  }
};

export const bootstrapHillston = async (
  manager: EntityManager,
): Promise<{ summary: BootstrapSummary; inventory: InventorySummary }> => {
  const summary: BootstrapSummary = {
    property: 'updated',
    floors: { created: 0, updated: 0 },
    roomTypes: { created: 0, updated: 0 },
    amenities: {
      created: 0,
      updated: 0,
      skipped: true,
      todo: hillstonBootstrapData.amenitiesTodo,
    },
    rooms: { created: 0, updated: 0 },
  };

  const propertyRepository = manager.getRepository(PropertyEntity);
  const floorRepository = manager.getRepository(FloorEntity);
  const roomTypeRepository = manager.getRepository(RoomTypeEntity);
  const roomRepository = manager.getRepository(RoomEntity);

  const propertyResult = await upsertProperty(propertyRepository);
  summary.property = propertyResult.action;
  const property = propertyResult.entity;

  const floorByCode = new Map<string, FloorEntity>();
  for (const floorSeed of hillstonBootstrapData.floors) {
    const result = await upsertFloor(floorRepository, property.id, floorSeed);
    summary.floors[result.action] += 1;
    floorByCode.set(floorSeed.code, result.entity);
  }

  const roomTypeByCode = new Map<string, RoomTypeEntity>();
  for (const roomTypeSeed of hillstonBootstrapData.roomTypes) {
    const result = await upsertRoomType(roomTypeRepository, property.id, roomTypeSeed);
    summary.roomTypes[result.action] += 1;
    roomTypeByCode.set(roomTypeSeed.code, result.entity);
  }

  for (const roomSeed of hillstonBootstrapData.rooms) {
    const floor = floorByCode.get(roomSeed.floorCode);
    const roomType = roomTypeByCode.get(roomSeed.roomTypeCode);

    if (!floor || !roomType) {
      throw new Error(`Invalid Hillston room seed for room ${roomSeed.roomNumber}`);
    }

    const result = await upsertRoom(roomRepository, property.id, floor.id, roomType.id, roomSeed);
    summary.rooms[result.action] += 1;
  }

  const inventory = await verifyHillstonInventory(
    property.id,
    roomTypeByCode,
    floorRepository,
    roomTypeRepository,
    roomRepository,
  );

  return { summary, inventory };
};

const upsertProperty = async (
  repository: Repository<PropertyEntity>,
): Promise<{ action: MutationAction; entity: PropertyEntity }> => {
  const existing = await repository.findOne({
    where: { code: HILLSTON_PROPERTY_CODE },
  });
  const entity = repository.create({
    ...(existing ?? {}),
    ...hillstonBootstrapData.property,
    panNumber: null,
    cinNumber: null,
    logoUrl: null,
    website: null,
  });

  return {
    action: existing ? 'updated' : 'created',
    entity: await repository.save(entity),
  };
};

const upsertFloor = async (
  repository: Repository<FloorEntity>,
  propertyId: string,
  seed: HillstonFloorSeed,
): Promise<{ action: MutationAction; entity: FloorEntity }> => {
  const existing = await repository.findOne({
    where: { propertyId, code: seed.code },
  });
  const entity = repository.create({
    ...(existing ?? {}),
    propertyId,
    ...seed,
    description: null,
    status: FloorStatus.ACTIVE,
  });

  return {
    action: existing ? 'updated' : 'created',
    entity: await repository.save(entity),
  };
};

const upsertRoomType = async (
  repository: Repository<RoomTypeEntity>,
  propertyId: string,
  seed: HillstonRoomTypeSeed,
): Promise<{ action: MutationAction; entity: RoomTypeEntity }> => {
  const existing = await repository.findOne({
    where: { propertyId, code: seed.code },
  });
  const entity = repository.create({
    ...(existing ?? {}),
    propertyId,
    ...seed,
    status: RoomTypeStatus.ACTIVE,
  });

  return {
    action: existing ? 'updated' : 'created',
    entity: await repository.save(entity),
  };
};

const upsertRoom = async (
  repository: Repository<RoomEntity>,
  propertyId: string,
  floorId: string,
  roomTypeId: string,
  seed: HillstonRoomSeed,
): Promise<{ action: MutationAction; entity: RoomEntity }> => {
  const existing = await repository.findOne({
    where: { propertyId, roomNumber: seed.roomNumber },
  });
  const entity = repository.create({
    ...(existing ?? {}),
    propertyId,
    floorId,
    roomTypeId,
    roomNumber: seed.roomNumber,
    displayName: seed.roomNumber,
    description: null,
    status: RoomStatus.ACTIVE,
    operationalStatus: RoomOperationalStatus.READY,
  });

  return {
    action: existing ? 'updated' : 'created',
    entity: await repository.save(entity),
  };
};

const verifyHillstonInventory = async (
  propertyId: string,
  roomTypeByCode: Map<string, RoomTypeEntity>,
  floorRepository: Repository<FloorEntity>,
  roomTypeRepository: Repository<RoomTypeEntity>,
  roomRepository: Repository<RoomEntity>,
): Promise<InventorySummary> => {
  const deluxeRoomType = roomTypeByCode.get('DLX');
  const suiteRoomType = roomTypeByCode.get('STE');

  if (!deluxeRoomType || !suiteRoomType) {
    throw new Error('Hillston room types were not created correctly');
  }

  const inventory = {
    properties: 1,
    guestFloors: await floorRepository.count({ where: { propertyId } }),
    roomTypes: await roomTypeRepository.count({ where: { propertyId } }),
    rooms: await roomRepository.count({ where: { propertyId } }),
    deluxeRooms: await roomRepository.count({
      where: { propertyId, roomTypeId: deluxeRoomType.id },
    }),
    suiteRooms: await roomRepository.count({
      where: { propertyId, roomTypeId: suiteRoomType.id },
    }),
  };

  assertInventoryCounts(inventory);

  return inventory;
};

export const assertInventoryCounts = (inventory: InventorySummary): void => {
  const expected = expectedHillstonInventory;

  Object.entries(expected).forEach(([key, value]) => {
    const actual = inventory[key as keyof InventorySummary];

    if (actual !== value) {
      throw new Error(`Expected ${key} to be ${value}, received ${actual}`);
    }
  });

  createPaginationMeta(1, inventory.rooms, inventory.rooms);
};

const printSummary = ({
  summary,
  inventory,
}: {
  summary: BootstrapSummary;
  inventory: InventorySummary;
}): void => {
  console.log('Hillston bootstrap completed');
  console.log(`Property ${summary.property === 'created' ? 'Created' : 'Updated'}`);
  console.log(`Floors Created/Updated: ${summary.floors.created}/${summary.floors.updated}`);
  console.log(
    `Room Types Created/Updated: ${summary.roomTypes.created}/${summary.roomTypes.updated}`,
  );
  console.log(
    `Amenities Created/Updated: ${summary.amenities.created}/${summary.amenities.updated} (skipped: ${summary.amenities.todo})`,
  );
  console.log(`Rooms Created/Updated: ${summary.rooms.created}/${summary.rooms.updated}`);
  console.log('Inventory Summary');
  console.log(`Properties: ${inventory.properties}`);
  console.log(`Guest Floors: ${inventory.guestFloors}`);
  console.log(`Room Types: ${inventory.roomTypes}`);
  console.log(`Rooms: ${inventory.rooms}`);
  console.log(`Deluxe Rooms: ${inventory.deluxeRooms}`);
  console.log(`Suite Rooms: ${inventory.suiteRooms}`);
};

if (require.main === module) {
  runHillstonBootstrap()
    .then(printSummary)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
