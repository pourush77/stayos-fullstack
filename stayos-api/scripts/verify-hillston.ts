import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import dataSource from '../src/database/data-source';
import { expectedHillstonInventory, HILLSTON_PROPERTY_CODE } from './bootstrap-hillston';

process.env.NODE_ENV ??= 'development';
process.env.PORT ??= '3000';
process.env.JWT_SECRET ??= 'supersecret';
process.env.JWT_REFRESH_SECRET ??= 'superrefreshsecret';

interface HillstonVerificationSummary {
  propertyName: string;
  floorsCount: number;
  roomTypesCount: number;
  roomsCount: number;
  deluxeCount: number;
  suiteCount: number;
}

const requiredTables = ['properties', 'floors', 'room_types', 'rooms', 'migrations'];
const requiredSwaggerPaths = [
  '/api/v1/properties',
  '/api/v1/properties/{propertyId}/floors',
  '/api/v1/properties/{propertyId}/room-types',
  '/api/v1/properties/{propertyId}/rooms',
];

const verifyTables = async (): Promise<void> => {
  const rows = await dataSource.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
    `,
    [requiredTables],
  );
  const foundTables = new Set((rows as Array<{ table_name: string }>).map((row) => row.table_name));
  const missingTables = requiredTables.filter((table) => !foundTables.has(table));

  if (missingTables.length > 0) {
    throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
  }
};

const verifyInventory = async (): Promise<HillstonVerificationSummary> => {
  const rows = (await dataSource.query(
    `
      SELECT
        p.id,
        p.name AS "propertyName",
        (SELECT COUNT(*)::int FROM floors f WHERE f.property_id = p.id) AS "floorsCount",
        (SELECT COUNT(*)::int FROM room_types rt WHERE rt.property_id = p.id) AS "roomTypesCount",
        (SELECT COUNT(*)::int FROM rooms r WHERE r.property_id = p.id) AS "roomsCount",
        (
          SELECT COUNT(*)::int
          FROM rooms r
          INNER JOIN room_types rt ON rt.id = r.room_type_id
          WHERE r.property_id = p.id AND rt.code = 'DLX'
        ) AS "deluxeCount",
        (
          SELECT COUNT(*)::int
          FROM rooms r
          INNER JOIN room_types rt ON rt.id = r.room_type_id
          WHERE r.property_id = p.id AND rt.code = 'STE'
        ) AS "suiteCount"
      FROM properties p
      WHERE p.code = $1
      GROUP BY p.id, p.name
    `,
    [HILLSTON_PROPERTY_CODE],
  )) as Array<HillstonVerificationSummary>;

  const summary = rows[0];

  if (!summary) {
    throw new Error(`Property ${HILLSTON_PROPERTY_CODE} was not found`);
  }

  const expected = expectedHillstonInventory;
  const actual = {
    properties: 1,
    guestFloors: summary.floorsCount,
    roomTypes: summary.roomTypesCount,
    rooms: summary.roomsCount,
    deluxeRooms: summary.deluxeCount,
    suiteRooms: summary.suiteCount,
  };

  Object.entries(expected).forEach(([key, expectedValue]) => {
    const actualValue = actual[key as keyof typeof actual];

    if (actualValue !== expectedValue) {
      throw new Error(`Expected ${key} to be ${expectedValue}, received ${actualValue}`);
    }
  });

  return summary;
};

const verifySwagger = async (): Promise<void> => {
  let app: INestApplication | undefined;

  try {
    const { AppModule } = await import('../src/app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    const configService = app.get(ConfigService);
    app.setGlobalPrefix('api/v1');

    const swaggerOptions = new DocumentBuilder()
      .setTitle(configService.get<string>('app.name') ?? 'StayOS Platform API')
      .setDescription('StayOS hospitality platform API documentation')
      .setVersion(configService.get<string>('app.version') ?? '1.0.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerOptions);
    const missingPaths = requiredSwaggerPaths.filter((path) => !document.paths[path]);

    if (missingPaths.length > 0) {
      throw new Error(`Missing Swagger paths: ${missingPaths.join(', ')}`);
    }
  } finally {
    await app?.close();
  }
};

const printSummary = (summary: HillstonVerificationSummary): void => {
  console.log('Hillston verification completed');
  console.log(`Property Name: ${summary.propertyName}`);
  console.log(`Floors Count: ${summary.floorsCount}`);
  console.log(`Room Types Count: ${summary.roomTypesCount}`);
  console.log(`Rooms Count: ${summary.roomsCount}`);
  console.log(`Deluxe Count: ${summary.deluxeCount}`);
  console.log(`Suite Count: ${summary.suiteCount}`);
  console.log('Tables Verified: properties, floors, room_types, rooms, migrations');
  console.log('Swagger Status: Hotel Inventory endpoints present');
};

const run = async (): Promise<void> => {
  await dataSource.initialize();

  try {
    await verifyTables();
    const summary = await verifyInventory();
    await dataSource.destroy();
    await verifySwagger();
    printSummary(summary);
  } catch (error) {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }

    throw error;
  }
};

if (require.main === module) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
