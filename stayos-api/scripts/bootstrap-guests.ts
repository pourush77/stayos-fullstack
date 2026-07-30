import { EntityManager, Repository } from 'typeorm';
import { GuestStatus } from '../src/core/guests/domain/guest-status.enum';
import { GuestEntity } from '../src/core/guests/infrastructure/guest.entity';
import { PropertyEntity } from '../src/core/properties/infrastructure/property.entity';
import dataSource from '../src/database/data-source';
import { HILLSTON_PROPERTY_CODE } from './bootstrap-hillston';

type MutationAction = 'created' | 'updated';

interface MutationSummary {
  created: number;
  updated: number;
}

interface GuestBootstrapSummary {
  guests: MutationSummary;
}

interface GuestVerificationSummary {
  totalGuests: number;
  vipGuests: number;
}

interface HillstonGuestSeed {
  firstName: string;
  lastName?: string;
  phone: string;
  email: string;
  gender?: string;
  nationality?: string;
  preferredLanguage: string;
  companyName?: string;
  gstNumber?: string;
  vipStatus: boolean;
  notes: string;
}

interface GuestSimulationState {
  guests: Array<{
    propertyCode: string;
    phone: string;
    vipStatus: boolean;
  }>;
}

export const hillstonGuestBootstrapData: HillstonGuestSeed[] = [
  {
    firstName: 'Ananya',
    lastName: 'Rao',
    phone: '9876522110',
    email: 'ananya.rao@example.com',
    gender: 'Female',
    nationality: 'Indian',
    preferredLanguage: 'English',
    vipStatus: true,
    notes: 'Returning guest. Prefers quiet floor and early tea service.',
  },
  {
    firstName: 'Rhea',
    lastName: 'Malhotra',
    phone: '9822044551',
    email: 'rhea.m@example.com',
    gender: 'Female',
    nationality: 'Indian',
    preferredLanguage: 'Hindi',
    vipStatus: false,
    notes: 'Prefers high floor.',
  },
  {
    firstName: 'Dev',
    lastName: 'Sharma',
    phone: '9811130444',
    email: 'dev.sharma@example.com',
    gender: 'Male',
    nationality: 'Indian',
    preferredLanguage: 'Hindi',
    vipStatus: false,
    notes: 'Walk-in guest.',
  },
  {
    firstName: 'Mr',
    lastName: 'Kapoor',
    phone: '9000088221',
    email: 'kapoor@example.com',
    gender: 'Male',
    nationality: 'Indian',
    preferredLanguage: 'English',
    vipStatus: true,
    notes: 'VIP guest. Airport pickup required.',
  },
  {
    firstName: 'Jaipur Textiles Group',
    phone: '9988743000',
    email: 'travel@jaipurtextiles.example',
    companyName: 'Jaipur Textiles',
    gstNumber: '23AAAAA0000A1Z5',
    preferredLanguage: 'English',
    vipStatus: false,
    notes: 'Corporate/group booking contact.',
  },
];

export const expectedHillstonGuests: GuestVerificationSummary = {
  totalGuests: 5,
  vipGuests: 2,
};

export const createHillstonGuestSimulationState = (): GuestSimulationState => ({
  guests: [],
});

export const simulateHillstonGuestBootstrap = (
  state: GuestSimulationState,
): GuestVerificationSummary => {
  hillstonGuestBootstrapData.forEach((guest) => {
    const existing = state.guests.find(
      (candidate) =>
        candidate.propertyCode === HILLSTON_PROPERTY_CODE && candidate.phone === guest.phone,
    );

    if (existing) {
      existing.vipStatus = guest.vipStatus;
      return;
    }

    state.guests.push({
      propertyCode: HILLSTON_PROPERTY_CODE,
      phone: guest.phone,
      vipStatus: guest.vipStatus,
    });
  });

  return {
    totalGuests: state.guests.filter((guest) => guest.propertyCode === HILLSTON_PROPERTY_CODE)
      .length,
    vipGuests: state.guests.filter(
      (guest) => guest.propertyCode === HILLSTON_PROPERTY_CODE && guest.vipStatus,
    ).length,
  };
};

export const runHillstonGuestBootstrap = async (): Promise<{
  summary: GuestBootstrapSummary;
  verification: GuestVerificationSummary;
}> => {
  await dataSource.initialize();

  try {
    return await dataSource.transaction(async (manager) => bootstrapHillstonGuests(manager));
  } finally {
    await dataSource.destroy();
  }
};

export const bootstrapHillstonGuests = async (
  manager: EntityManager,
): Promise<{ summary: GuestBootstrapSummary; verification: GuestVerificationSummary }> => {
  const propertyRepository = manager.getRepository(PropertyEntity);
  const guestRepository = manager.getRepository(GuestEntity);
  const property = await propertyRepository.findOne({
    where: { code: HILLSTON_PROPERTY_CODE },
  });

  if (!property) {
    throw new Error(
      `Property ${HILLSTON_PROPERTY_CODE} was not found. Run bootstrap:hillston first.`,
    );
  }

  const summary: GuestBootstrapSummary = {
    guests: { created: 0, updated: 0 },
  };

  for (const guestSeed of hillstonGuestBootstrapData) {
    const result = await upsertGuest(guestRepository, property.id, guestSeed);
    summary.guests[result.action] += 1;
  }

  const verification = await verifyHillstonGuests(property.id, guestRepository);

  return { summary, verification };
};

const upsertGuest = async (
  repository: Repository<GuestEntity>,
  propertyId: string,
  seed: HillstonGuestSeed,
): Promise<{ action: MutationAction; entity: GuestEntity }> => {
  const existing = await repository.findOne({
    where: { propertyId, phone: seed.phone },
  });
  const entity = repository.create({
    ...(existing ?? {}),
    propertyId,
    firstName: seed.firstName,
    lastName: seed.lastName ?? null,
    displayName: [seed.firstName, seed.lastName].filter(Boolean).join(' '),
    phone: seed.phone,
    alternatePhone: null,
    email: seed.email,
    gender: seed.gender ?? null,
    dateOfBirth: null,
    anniversaryDate: null,
    nationality: seed.nationality ?? null,
    preferredLanguage: seed.preferredLanguage,
    companyName: seed.companyName ?? null,
    gstNumber: seed.gstNumber ?? null,
    vipStatus: seed.vipStatus,
    blacklistStatus: false,
    notes: seed.notes,
    status: GuestStatus.ACTIVE,
  });

  return {
    action: existing ? 'updated' : 'created',
    entity: await repository.save(entity),
  };
};

const verifyHillstonGuests = async (
  propertyId: string,
  repository: Repository<GuestEntity>,
): Promise<GuestVerificationSummary> => {
  const verification = {
    totalGuests: await repository.count({ where: { propertyId } }),
    vipGuests: await repository.count({ where: { propertyId, vipStatus: true } }),
  };

  assertHillstonGuestCounts(verification);

  return verification;
};

export const assertHillstonGuestCounts = (verification: GuestVerificationSummary): void => {
  Object.entries(expectedHillstonGuests).forEach(([key, expectedValue]) => {
    const actualValue = verification[key as keyof GuestVerificationSummary];

    if (actualValue !== expectedValue) {
      throw new Error(`Expected ${key} to be ${expectedValue}, received ${actualValue}`);
    }
  });
};

const printSummary = ({
  summary,
  verification,
}: {
  summary: GuestBootstrapSummary;
  verification: GuestVerificationSummary;
}): void => {
  console.log('Hillston guest bootstrap completed');
  console.log(`Guests Created/Updated: ${summary.guests.created}/${summary.guests.updated}`);
  console.log('Guest Verification Summary');
  console.log(`Total Guests: ${verification.totalGuests}`);
  console.log(`VIP Guests: ${verification.vipGuests}`);
};

if (require.main === module) {
  runHillstonGuestBootstrap()
    .then(printSummary)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
