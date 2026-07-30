import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ApiResponseInterceptor } from '../common/interceptors/api-response.interceptor';
import { requestIdMiddleware } from '../common/middleware/request-id.middleware';
import { FloorStatus } from './floors/domain/floor-status.enum';
import { FloorsController } from './floors/floors.controller';
import { FloorsService } from './floors/floors.service';
import { PropertyStatus } from './properties/domain/property-status.enum';
import { PropertiesController } from './properties/properties.controller';
import { PropertiesService } from './properties/properties.service';
import { RoomTypeStatus } from './room-types/domain/room-type-status.enum';
import { RoomTypesController } from './room-types/room-types.controller';
import { RoomTypesService } from './room-types/room-types.service';
import { RoomOperationalStatus } from './rooms/domain/room-operational-status.enum';
import { RoomStatus } from './rooms/domain/room-status.enum';
import { RoomsController } from './rooms/rooms.controller';
import { RoomsService } from './rooms/rooms.service';

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const baseDate = new Date('2026-06-30T00:00:00.000Z');
const property = {
  id: propertyId,
  code: 'HILLSTON_IND',
  name: 'Hillston Resort & Club',
  legalName: 'Oyster Clubs and Resorts Pvt. Ltd.',
  gstNumber: '23AABCO9368D1ZG',
  panNumber: null,
  cinNumber: null,
  logoUrl: null,
  email: 'oystergroupcompany@gmail.com',
  phone: '9826388222',
  website: null,
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
  createdAt: baseDate,
  updatedAt: baseDate,
};
const floor = {
  id: '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671',
  propertyId,
  code: 'SECOND',
  name: 'Second Floor',
  floorNumber: 2,
  displayOrder: 1,
  description: null,
  status: FloorStatus.ACTIVE,
  createdAt: baseDate,
  updatedAt: baseDate,
};
const roomType = {
  id: '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672',
  propertyId,
  code: 'DLX',
  name: 'Deluxe',
  description: null,
  baseOccupancy: 2,
  maxOccupancy: 3,
  maxAdults: 2,
  maxChildren: 1,
  bedType: 'King',
  sizeSqFt: 251,
  status: RoomTypeStatus.ACTIVE,
  createdAt: baseDate,
  updatedAt: baseDate,
};
const room = {
  id: '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673',
  propertyId,
  floorId: floor.id,
  roomTypeId: roomType.id,
  roomNumber: '201',
  displayName: '201',
  description: null,
  status: RoomStatus.ACTIVE,
  operationalStatus: RoomOperationalStatus.READY,
  createdAt: baseDate,
  updatedAt: baseDate,
};

describe('Hotel Inventory API smoke', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertiesController, FloorsController, RoomTypesController, RoomsController],
      providers: [
        {
          provide: PropertiesService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({
              data: [property],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
            }),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: FloorsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({
              data: [floor],
              pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
            }),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: RoomTypesService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({
              data: [roomType],
              pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
            }),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: RoomsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({
              data: [room],
              pagination: { page: 1, limit: 20, total: 24, totalPages: 2 },
            }),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(requestIdMiddleware);
    app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/properties returns a standard list response', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/properties')
      .set('x-request-id', 'smoke-properties')
      .expect(200)
      .expect(({ body, headers }) => {
        expect(headers['x-request-id']).toBe('smoke-properties');
        expect(body).toMatchObject({
          success: true,
          data: [{ code: 'HILLSTON_IND' }],
          pagination: { total: 1 },
          meta: { requestId: 'smoke-properties', version: 'v1' },
        });
      });
  });

  it('GET /api/v1/properties/:propertyId/floors returns floors', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/floors`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          data: [{ code: 'SECOND' }],
          pagination: { total: 2 },
        });
      });
  });

  it('GET /api/v1/properties/:propertyId/room-types returns room types', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/room-types`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          data: [{ code: 'DLX' }],
          pagination: { total: 2 },
        });
      });
  });

  it('GET /api/v1/properties/:propertyId/rooms returns rooms', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/rooms`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          data: [{ roomNumber: '201' }],
          pagination: { total: 24 },
        });
      });
  });
});
