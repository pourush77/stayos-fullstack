import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { GuestsService } from '../src/core/guests/guests.service';
import { GuestEntity } from '../src/core/guests/infrastructure/guest.entity';
import { ReservationsService } from '../src/core/reservations/reservations.service';
import { BillingService } from '../src/core/billing/billing.service';
import { RatesService } from '../src/core/rates/rates.service';
import { InventoryReconciliationService } from '../src/core/inventory/inventory-reconciliation.service';
import { PropertyEntity } from '../src/core/properties/infrastructure/property.entity';
import { RoomEntity } from '../src/core/rooms/infrastructure/room.entity';
import { RoomTypeEntity } from '../src/core/room-types/infrastructure/room-type.entity';
import { ReservationEntity } from '../src/core/reservations/infrastructure/reservation.entity';
import { ReservationStatus } from '../src/core/reservations/domain/reservation-status.enum';
import { ReservationSource } from '../src/core/reservations/domain/reservation-source.enum';
import { ReservationPaymentStatus } from '../src/core/reservations/domain/reservation-payment-status.enum';
import { RoomOperationalStatus } from '../src/core/rooms/domain/room-operational-status.enum';
import { RatePlanStatus } from '../src/core/rates/domain/rate-plan-status.enum';
import { MealPlan } from '../src/core/rates/domain/meal-plan.enum';
import { FolioPaymentMethod } from '../src/core/billing/domain/folio-payment-method.enum';
import { calculateTotals } from '../src/core/billing/billing.mapper';
import { MaintenanceTicketEntity } from '../src/core/maintenance/infrastructure/maintenance-ticket.entity';
import { MaintenanceTicketCategory } from '../src/core/maintenance/domain/maintenance-ticket-category.enum';
import { MaintenanceTicketPriority } from '../src/core/maintenance/domain/maintenance-ticket-priority.enum';
import { MaintenanceTicketStatus } from '../src/core/maintenance/domain/maintenance-ticket-status.enum';
import { UserEntity } from '../src/core/auth/infrastructure/user.entity';
import { BusinessDateService } from '../src/core/properties/services/business-date.service';

const PROPERTY_CODE = 'HILLSTON_IND';
const CONFIRM = 'SEED-HILLSTON-STAGING';
const PREVIEW_FLAG = '--preview';

function wantsPreview(): boolean {
  return process.argv.includes(PREVIEW_FLAG);
}

function plusDays(baseDate: string, offset: number): string {
  const [year, month, day] = baseDate.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + offset));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

function requireStagingSafety(): void {
  if (process.env.STAGING_SEED_CONFIRM !== CONFIRM) {
    throw new Error(`Refusing to seed. Set STAGING_SEED_CONFIRM=${CONFIRM}`);
  }

  if (process.env.STAGING_SEED_PROPERTY_CODE !== PROPERTY_CODE) {
    throw new Error(`Refusing to seed. Set STAGING_SEED_PROPERTY_CODE=${PROPERTY_CODE}`);
  }

  const renderService = process.env.RENDER_SERVICE_NAME;

  if (renderService && !renderService.toLowerCase().includes('staging')) {
    throw new Error(
      `Refusing to seed Render service '${renderService}' because it is not staging.`,
    );
  }
}

async function main(): Promise<void> {
  requireStagingSafety();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  const ds = app.get(DataSource);
  const guests = app.get(GuestsService);
  const reservations = app.get(ReservationsService);
  const billing = app.get(BillingService);
  const rates = app.get(RatesService);
  const reconciliation = app.get(InventoryReconciliationService);
  const businessDate = app.get(BusinessDateService);

  try {
    const propertyRepo = ds.getRepository(PropertyEntity);
    const roomRepo = ds.getRepository(RoomEntity);
    const roomTypeRepo = ds.getRepository(RoomTypeEntity);
    const reservationRepo = ds.getRepository(ReservationEntity);

    const property = await propertyRepo.findOne({
      where: { code: PROPERTY_CODE },
    });

    if (!property) {
      throw new Error(`Property ${PROPERTY_CODE} not found.`);
    }

    const today = businessDate.resolveForProperty(property);
    const dateOnly = (offset: number) => plusDays(today, offset);

    const rooms = await roomRepo.find({
      where: { propertyId: property.id },
      order: { roomNumber: 'ASC' },
    });

    const roomTypes = await roomTypeRepo.find({
      where: { propertyId: property.id },
      order: { code: 'ASC' },
    });

    if (rooms.length !== 24) {
      throw new Error(`Expected 24 Hillston rooms, found ${rooms.length}.`);
    }

    if (roomTypes.length < 2) {
      throw new Error('Expected at least two Hillston room types.');
    }

    /*
     * ------------------------------------------------------------
     * ROOM TYPES / ROOMS
     * ------------------------------------------------------------
     */

    const roomTypesByCapacity = roomTypes
      .map((roomType) => ({
        roomType,
        rooms: rooms.filter((room) => room.roomTypeId === roomType.id),
      }))
      .sort((a, b) => b.rooms.length - a.rooms.length);

    const primaryType = roomTypesByCapacity[0].roomType;

    const secondaryType = roomTypesByCapacity[1].roomType;

    const primaryRooms = roomTypesByCapacity[0].rooms;

    const secondaryRooms = roomTypesByCapacity[1].rooms;

    if (primaryRooms.length < 7) {
      throw new Error('Need at least 7 rooms in the primary room type for staging scenarios.');
    }

    if (secondaryRooms.length < 1) {
      throw new Error('Need at least 1 room in the secondary room type for staging scenarios.');
    }

    if (wantsPreview()) {
      console.log('Hillston staging seed preview');
      console.log(`Property: ${property.name} (${property.code})`);
      console.log(
        `Business date: ${today} (${property.timezone}, cut-off ${property.businessDayCutOffTime})`,
      );
      console.log('DRY RUN ONLY - no data changed.');
      console.table([
        {
          scenario: 'Arrival today - assigned READY room',
          status: ReservationStatus.CONFIRMED,
          arrivalDate: dateOnly(0),
          departureDate: dateOnly(2),
          room: primaryRooms[0].roomNumber,
        },
        {
          scenario: 'Arrival today - unassigned',
          status: ReservationStatus.CONFIRMED,
          arrivalDate: dateOnly(0),
          departureDate: dateOnly(1),
          room: 'UNASSIGNED',
        },
        {
          scenario: 'Pending future hold',
          status: ReservationStatus.PENDING,
          arrivalDate: dateOnly(1),
          departureDate: dateOnly(3),
          room: 'UNASSIGNED',
        },
        {
          scenario: 'Future channel reservation',
          status: ReservationStatus.CONFIRMED,
          arrivalDate: dateOnly(2),
          departureDate: dateOnly(4),
          room: 'UNASSIGNED',
        },
        {
          scenario: 'In-house due out today - unpaid folio',
          status: ReservationStatus.CHECKED_IN,
          arrivalDate: dateOnly(-2),
          departureDate: dateOnly(0),
          room: primaryRooms[2].roomNumber,
        },
        {
          scenario: 'Same-day next arrival after turnover',
          status: ReservationStatus.CONFIRMED,
          arrivalDate: dateOnly(0),
          departureDate: dateOnly(2),
          room: primaryRooms[2].roomNumber,
        },
        {
          scenario: 'In-house due out today - paid folio',
          status: ReservationStatus.CHECKED_IN,
          arrivalDate: dateOnly(-1),
          departureDate: dateOnly(0),
          room: primaryRooms[3].roomNumber,
        },
        {
          scenario: 'Arrival today blocked by dirty room',
          status: ReservationStatus.CONFIRMED,
          arrivalDate: dateOnly(0),
          departureDate: dateOnly(1),
          room: primaryRooms[4].roomNumber,
        },
        {
          scenario: 'Future arrival assigned to maintenance room',
          status: ReservationStatus.CONFIRMED,
          arrivalDate: dateOnly(1),
          departureDate: dateOnly(3),
          room: primaryRooms[5].roomNumber,
        },
      ]);
      return;
    }

    const existingReservations = await reservationRepo.count({
      where: { propertyId: property.id },
    });

    if (existingReservations !== 0) {
      throw new Error(
        `Staging is not empty (${existingReservations} reservations). Run staging:reset first.`,
      );
    }

    const notReady = rooms.filter((room) => room.operationalStatus !== RoomOperationalStatus.READY);

    if (notReady.length) {
      throw new Error(
        `Staging is not at the clean baseline (${notReady.length} rooms not READY). Run staging:reset first.`,
      );
    }

    /*
     * ------------------------------------------------------------
     * STAGING RATE PLAN
     * ------------------------------------------------------------
     *
     * Create/reuse one explicit staging rate plan so that the
     * reservations generated below receive genuine PRICED
     * reservation snapshots.
     *
     * We deliberately do NOT make this the property's default rate
     * plan because we don't want the seed script overwriting
     * manager configuration.
     */

    const existingPlans = await rates.findRatePlans(property.id);

    let plan = existingPlans.find((ratePlan) => ratePlan.code === 'STAGING_BAR');

    if (!plan) {
      plan = await rates.createRatePlan(property.id, {
        code: 'STAGING_BAR',
        name: 'Staging BAR',
        description: 'Date-relative staging rate plan for frontend compatibility testing',
        isDefault: false,
        status: RatePlanStatus.ACTIVE,
        mealPlan: MealPlan.ROOM_ONLY,
        refundable: true,
      });
    } else if (plan.status !== RatePlanStatus.ACTIVE) {
      plan = await rates.updateRatePlan(property.id, plan.id, {
        status: RatePlanStatus.ACTIVE,
      });
    }

    for (const roomType of roomTypes) {
      const suiteLike = /suite|ste/i.test(`${roomType.code} ${roomType.name}`);

      await rates.upsertRatePlanRoomType(property.id, plan.id, {
        roomTypeId: roomType.id,

        baseOccupancy: Math.max(1, Math.min(2, roomType.maxAdults ?? 2)),

        baseRate: suiteLike ? '7500.00' : '4500.00',

        extraAdultCharge: suiteLike ? '1500.00' : '1000.00',

        extraChildCharge: suiteLike ? '900.00' : '700.00',
      });
    }

    /*
     * ------------------------------------------------------------
     * DEMO GUESTS
     * ------------------------------------------------------------
     */

    const guestSpecs = [
      ['Aarav', 'Mehta', '+919700001001'],
      ['Neha', 'Sharma', '+919700001002'],
      ['Rahul', 'Jain', '+919700001003'],
      ['Rhea', 'Kapoor', '+919700001004'],
      ['Vikram', 'Singh', '+919700001005'],
      ['Priya', 'Verma', '+919700001006'],
      ['David', 'Brown', '+919700001007'],
      ['Ananya', 'Rao', '+919700001008'],
      ['Karan', 'Bhatia', '+919700001009'],
    ] as const;

    const demoGuests: GuestEntity[] = [];

    for (const [firstName, lastName, phone] of guestSpecs) {
      demoGuests.push(
        await guests.create(property.id, {
          firstName,
          lastName,
          phone,

          email: `${firstName}.${lastName}.staging@stayos.local`.toLowerCase(),

          nationality: firstName === 'David' ? 'United States' : 'Indian',
        }),
      );
    }

    /*
     * Helper for creating reservations through the REAL
     * ReservationsService.
     *
     * Therefore:
     * - restrictions execute
     * - inventory executes
     * - pricing executes
     * - snapshots execute
     * - source/provenance rules execute
     */

    const create = (
      guestIndex: number,
      input: Partial<Parameters<typeof reservations.create>[1]> & {
        arrivalDate: string;
        departureDate: string;
        roomTypeId: string;
      },
    ) =>
      reservations.create(property.id, {
        guestId: demoGuests[guestIndex].id,

        adults: 2,
        children: 0,

        ratePlanId: plan!.id,

        source: ReservationSource.FRONT_DESK,

        paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,

        ...input,
      } as Parameters<typeof reservations.create>[1]);

    /*
     * ------------------------------------------------------------
     * SCENARIO 1
     * Arrival today — room assigned and READY
     * ------------------------------------------------------------
     */

    const arrivalReady = await create(0, {
      arrivalDate: dateOnly(0),
      departureDate: dateOnly(2),

      roomTypeId: primaryType.id,
      roomId: primaryRooms[0].id,

      status: ReservationStatus.CONFIRMED,

      notes: 'STAGING: Arrival today, room READY. Use for check-in flow.',
    });

    /*
     * ------------------------------------------------------------
     * SCENARIO 2
     * Arrival today — NO physical room assigned
     * ------------------------------------------------------------
     */

    const arrivalUnassigned = await create(1, {
      arrivalDate: dateOnly(0),
      departureDate: dateOnly(1),

      roomTypeId: primaryType.id,

      status: ReservationStatus.CONFIRMED,

      source: ReservationSource.PHONE,

      notes: 'STAGING: Arrival today with no physical room assignment.',
    });

    /*
     * ------------------------------------------------------------
     * SCENARIO 3
     * Pending reservation / hold
     * ------------------------------------------------------------
     */

    const pending = await create(2, {
      arrivalDate: dateOnly(1),
      departureDate: dateOnly(3),

      roomTypeId: primaryType.id,

      status: ReservationStatus.PENDING,

      notes: 'STAGING: PENDING hold for reservation confirmation testing.',
    });

    /*
     * ------------------------------------------------------------
     * SCENARIO 4
     * Channel reservation with provenance
     * ------------------------------------------------------------
     */

    const channel = await create(3, {
      arrivalDate: dateOnly(2),
      departureDate: dateOnly(4),

      roomTypeId: secondaryType.id,

      status: ReservationStatus.CONFIRMED,

      source: ReservationSource.CHANNEL,

      sourceProvider: 'BOOKING_COM',

      externalReservationId: 'STG-BOOKING-1001',

      externalConfirmationId: 'BC-STG-1001',

      notes: 'STAGING: Channel provenance / external ID scenario.',
    });

    /*
     * ------------------------------------------------------------
     * SCENARIO 5 + 6
     *
     * Same-day room turnover.
     *
     * Guest A:
     *   checked-in
     *   departure TODAY
     *
     * Guest B:
     *   arrival TODAY
     *   same physical room
     *
     * After checkout the room becomes NEEDS_CLEANING.
     * Guest B should therefore remain blocked until housekeeping
     * makes the room READY.
     * ------------------------------------------------------------
     */

    const dueOut = await create(4, {
      arrivalDate: dateOnly(-2),
      departureDate: dateOnly(0),

      roomTypeId: primaryType.id,
      roomId: primaryRooms[2].id,

      status: ReservationStatus.CONFIRMED,

      notes: 'STAGING: In-house, departure today, unpaid folio / late-checkout scenario.',
    });

    const sameDayNext = await create(5, {
      arrivalDate: dateOnly(0),
      departureDate: dateOnly(2),

      roomTypeId: primaryType.id,
      roomId: primaryRooms[2].id,

      status: ReservationStatus.CONFIRMED,

      notes: 'STAGING: Same-day next arrival; blocked until prior checkout + cleaning + READY.',
    });

    /*
     * ------------------------------------------------------------
     * SCENARIO 7
     * Checked-in guest with fully paid folio.
     *
     * Checkout should be able to:
     * - settle folio
     * - finalize invoice
     * - checkout reservation
     * - send room to NEEDS_CLEANING
     * ------------------------------------------------------------
     */

    const checkoutReady = await create(6, {
      arrivalDate: dateOnly(-1),
      departureDate: dateOnly(0),

      roomTypeId: primaryType.id,
      roomId: primaryRooms[3].id,

      status: ReservationStatus.CONFIRMED,

      notes: 'STAGING: In-house with zero-balance folio; use for successful checkout.',
    });

    /*
     * ------------------------------------------------------------
     * SCENARIO 8
     * Arrival blocked by DIRTY room
     * ------------------------------------------------------------
     */

    const dirtyArrival = await create(7, {
      arrivalDate: dateOnly(0),
      departureDate: dateOnly(1),

      roomTypeId: primaryType.id,
      roomId: primaryRooms[4].id,

      status: ReservationStatus.CONFIRMED,

      notes: 'STAGING: Arrival assigned to a room that will be marked NEEDS_CLEANING.',
    });

    /*
     * ------------------------------------------------------------
     * SCENARIO 9
     * Reservation associated with maintenance room
     * ------------------------------------------------------------
     */

    const maintenanceArrival = await create(8, {
      arrivalDate: dateOnly(1),
      departureDate: dateOnly(3),

      roomTypeId: primaryType.id,
      roomId: primaryRooms[5].id,

      status: ReservationStatus.CONFIRMED,

      notes: 'STAGING: Future reservation assigned to a room later placed in MAINTENANCE.',
    });

    /*
     * ------------------------------------------------------------
     * OPERATIONAL FIXTURE STATE
     * ------------------------------------------------------------
     *
     * These reservations were already created as CONFIRMED,
     * meaning their inventory entitlement already exists.
     *
     * We therefore change two to CHECKED_IN directly for staging
     * fixture preparation without changing inventory.
     */

    await ds.transaction(async (manager) => {
      const reservationManager = manager.getRepository(ReservationEntity);

      const roomManager = manager.getRepository(RoomEntity);

      for (const reservation of [dueOut, checkoutReady]) {
        reservation.status = ReservationStatus.CHECKED_IN;

        await reservationManager.save(reservation);

        const room = await roomManager.findOneByOrFail({
          id: reservation.roomId!,
        });

        room.operationalStatus = RoomOperationalStatus.OCCUPIED;

        room.operationalStatusReason = 'STAGING_IN_HOUSE';

        room.operationalStatusNote = reservation.reservationCode;

        await roomManager.save(room);
      }

      /*
       * Dirty room scenario
       */

      const dirty = await roomManager.findOneByOrFail({
        id: dirtyArrival.roomId!,
      });

      dirty.operationalStatus = RoomOperationalStatus.NEEDS_CLEANING;

      dirty.operationalStatusReason = 'STAGING_DIRTY_ROOM';

      dirty.operationalStatusNote = 'Arrival waiting on housekeeping';

      await roomManager.save(dirty);

      /*
       * Maintenance scenario
       */

      const maintenance = await roomManager.findOneByOrFail({
        id: maintenanceArrival.roomId!,
      });

      maintenance.operationalStatus = RoomOperationalStatus.MAINTENANCE;

      maintenance.operationalStatusReason = 'STAGING_MAINTENANCE';

      maintenance.operationalStatusNote = 'AC not cooling — staging scenario';

      await roomManager.save(maintenance);
    });

    /*
     * ------------------------------------------------------------
     * BILLING FIXTURES
     * ------------------------------------------------------------
     *
     * dueOut:
     *   real ROOM charge
     *   unpaid
     *   checkout should therefore be blocked
     *
     * checkoutReady:
     *   real ROOM charge
     *   exact payment
     *   folio remains OPEN
     *
     * Normal checkout can then settle and finalize its invoice.
     */

    await billing.getOrCreateFolioForReservation(property.id, dueOut.id);

    const readyFolio = await billing.getOrCreateFolioForReservation(property.id, checkoutReady.id);

    const readyTotals = calculateTotals(readyFolio.charges ?? [], readyFolio.payments ?? []);

    if (Number(readyTotals.balance) > 0) {
      await billing.addPayment(property.id, readyFolio.id, {
        method: FolioPaymentMethod.UPI,

        amount: readyTotals.balance,

        reference: 'STAGING-CHECKOUT-READY',

        notes: 'Staging exact-balance payment',

        idempotencyKey: 'STAGING-CHECKOUT-READY',
      });
    }

    /*
     * ------------------------------------------------------------
     * MAINTENANCE TICKET
     * ------------------------------------------------------------
     */

    const reporter = await ds
      .getRepository(UserEntity)
      .createQueryBuilder('u')
      .where('u.propertyId = :propertyId', {
        propertyId: property.id,
      })
      .orWhere('u.propertyId IS NULL')
      .orderBy('u.createdAt', 'ASC')
      .getOne();

    if (reporter) {
      const maintenanceRepo = ds.getRepository(MaintenanceTicketEntity);

      await maintenanceRepo.save(
        maintenanceRepo.create({
          propertyId: property.id,

          roomId: maintenanceArrival.roomId!,

          reportedByUserId: reporter.id,

          assignedToUserId: null,

          title: 'AC not cooling — staging scenario',

          description: 'Frontend compatibility fixture. Resolve this ticket to test room recovery.',

          category: MaintenanceTicketCategory.HVAC,

          priority: MaintenanceTicketPriority.HIGH,

          status: MaintenanceTicketStatus.OPEN,

          makesRoomUnavailable: true,

          reportedAt: new Date(),

          resolvedAt: null,

          resolutionNote: null,
        }),
      );
    }

    /*
     * ------------------------------------------------------------
     * INVENTORY INVARIANT CHECK
     * ------------------------------------------------------------
     */

    const rec = await reconciliation.reconcile(property.id);

    if (!rec.consistent) {
      throw new Error(`Inventory reconciliation failed: ${JSON.stringify(rec.countsByType)}`);
    }

    /*
     * ------------------------------------------------------------
     * FINAL SUMMARY
     * ------------------------------------------------------------
     */

    const finalRooms = await roomRepo.find({
      where: {
        propertyId: property.id,
      },

      order: {
        roomNumber: 'ASC',
      },
    });

    const finalReservations = await reservationRepo.find({
      where: {
        propertyId: property.id,
      },

      order: {
        arrivalDate: 'ASC',
      },
    });

    const counts = finalReservations.reduce<Record<string, number>>((acc, reservation) => {
      acc[reservation.status] = (acc[reservation.status] ?? 0) + 1;

      return acc;
    }, {});

    console.log('\nHillston staging seed complete.');

    console.log(`Property: ${property.name} (${property.code})`);

    console.log(`Rate plan: ${plan.code} / ${plan.name}`);

    console.log(`Reservations: ${finalReservations.length}`, counts);

    console.log(
      `Rooms: READY=${
        finalRooms.filter((room) => room.operationalStatus === RoomOperationalStatus.READY).length
      }, OCCUPIED=${
        finalRooms.filter((room) => room.operationalStatus === RoomOperationalStatus.OCCUPIED)
          .length
      }, NEEDS_CLEANING=${
        finalRooms.filter((room) => room.operationalStatus === RoomOperationalStatus.NEEDS_CLEANING)
          .length
      }, MAINTENANCE=${
        finalRooms.filter((room) => room.operationalStatus === RoomOperationalStatus.MAINTENANCE)
          .length
      }`,
    );

    console.log('Inventory reconciliation: 0 discrepancies');

    console.log('\nScenario reservations:');

    for (const reservation of [
      arrivalReady,
      arrivalUnassigned,
      pending,
      channel,
      dueOut,
      sameDayNext,
      checkoutReady,
      dirtyArrival,
      maintenanceArrival,
    ]) {
      console.log(
        `  ${reservation.reservationCode} | ${reservation.status.padEnd(
          10,
        )} | ${reservation.arrivalDate} -> ${reservation.departureDate} | room=${
          reservation.roomId ?? 'UNASSIGNED'
        } | ${reservation.notes ?? ''}`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
