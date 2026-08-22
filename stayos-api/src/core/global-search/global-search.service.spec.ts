import { Repository } from 'typeorm';
import { FolioEntity } from '../billing/infrastructure/folio.entity';
import { GuestStatus } from '../guests/domain/guest-status.enum';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { GroupBookingEntity } from '../operations/infrastructure/group-booking.entity';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { GlobalSearchResultType } from './dto/global-search-response.dto';
import { GlobalSearchService } from './global-search.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';

function chainableQueryBuilder(results: unknown[] = []) {
  return {
    addOrderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(results),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  };
}

function repositoryWithQueryBuilder<T extends object>(queryBuilder: unknown): MockRepository<T> {
  return {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  };
}

function repository<T extends object>(queryBuilder: unknown): Repository<T> {
  return repositoryWithQueryBuilder<T>(queryBuilder) as unknown as Repository<T>;
}

describe('GlobalSearchService', () => {
  it('finds an edited guest by canonical name fields even when displayName is stale', async () => {
    const staleDisplayNameGuest: GuestEntity = {
      id: '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672',
      propertyId,
      property: undefined as never,
      firstName: 'Rhea',
      lastName: 'Kapoor Rai',
      displayName: 'Rhea Kapoor',
      phone: '+919876543210',
      alternatePhone: null,
      email: 'rhea@example.com',
      gender: null,
      dateOfBirth: null,
      anniversaryDate: null,
      nationality: 'Indian',
      preferredLanguage: 'English',
      companyName: null,
      gstNumber: null,
      vipStatus: false,
      blacklistStatus: false,
      notes: null,
      status: GuestStatus.ACTIVE,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-02T00:00:00.000Z'),
    };
    const guestsQueryBuilder = chainableQueryBuilder([staleDisplayNameGuest]);
    const emptyQueryBuilder = () => chainableQueryBuilder([]);
    const service = new GlobalSearchService(
      repository<GuestEntity>(guestsQueryBuilder),
      repository<ReservationEntity>(emptyQueryBuilder()),
      repository<RoomEntity>(emptyQueryBuilder()),
      repository<FolioEntity>(emptyQueryBuilder()),
      repository<GroupBookingEntity>(emptyQueryBuilder()),
      { findOne: jest.fn().mockResolvedValue({ id: propertyId }) } as never,
    );

    const result = await service.search(propertyId, { q: 'Rai', limit: 5 });

    expect(guestsQueryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("CONCAT_WS(' ', guest.firstName, guest.lastName) ILIKE :likeTerm"),
      expect.objectContaining({ likeTerm: '%Rai%' }),
    );
    expect(result.results.guests).toEqual([
      expect.objectContaining({
        id: staleDisplayNameGuest.id,
        type: GlobalSearchResultType.GUEST,
        title: 'Rhea Kapoor Rai',
      }),
    ]);
  });

  it('continues to rank existing displayName matches for guests', async () => {
    const preferredNameGuest: GuestEntity = {
      id: '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673',
      propertyId,
      property: undefined as never,
      firstName: 'Aarav',
      lastName: 'Mehta',
      displayName: 'Mr. Aarav',
      phone: '+919876543211',
      alternatePhone: null,
      email: null,
      gender: null,
      dateOfBirth: null,
      anniversaryDate: null,
      nationality: null,
      preferredLanguage: null,
      companyName: null,
      gstNumber: null,
      vipStatus: false,
      blacklistStatus: false,
      notes: null,
      status: GuestStatus.ACTIVE,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-02T00:00:00.000Z'),
    };
    const guestsQueryBuilder = chainableQueryBuilder([preferredNameGuest]);
    const emptyQueryBuilder = () => chainableQueryBuilder([]);
    const service = new GlobalSearchService(
      repository<GuestEntity>(guestsQueryBuilder),
      repository<ReservationEntity>(emptyQueryBuilder()),
      repository<RoomEntity>(emptyQueryBuilder()),
      repository<FolioEntity>(emptyQueryBuilder()),
      repository<GroupBookingEntity>(emptyQueryBuilder()),
      { findOne: jest.fn().mockResolvedValue({ id: propertyId }) } as never,
    );

    const result = await service.search(propertyId, { q: 'Mr. Aarav', limit: 5 });

    expect(result.results.guests).toHaveLength(1);
    expect(result.results.guests[0]).toEqual(
      expect.objectContaining({
        isExactMatch: true,
        title: 'Aarav Mehta',
      }),
    );
  });
});
