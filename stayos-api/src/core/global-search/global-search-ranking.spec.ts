import { calculateSearchRank } from './global-search-ranking';

function reservationRank(query: string, reservationCode: string, guestName = 'Guest') {
  return calculateSearchRank({
    query,
    basePriority: 80,
    fields: [
      { value: reservationCode, weight: 120 },
      { value: guestName, weight: 100 },
    ],
  });
}

function groupBookingRank(query: string, groupCode: string, groupName = 'Group') {
  return calculateSearchRank({
    query,
    basePriority: 90,
    fields: [
      { value: groupCode, weight: 140 },
      { value: groupName, weight: 130 },
    ],
  });
}

describe('global search ranking', () => {
  it('ranks exact group identifiers above unrelated reservation partial matches', () => {
    const exactGroup = groupBookingRank('GRP-00003', 'GRP-00003', 'Conference Block');
    const partialReservation = reservationRank('GRP-00003', 'RSV-10001', 'GRP-00003 guest');

    expect(exactGroup.isExactMatch).toBe(true);
    expect(exactGroup.priority).toBeGreaterThan(partialReservation.priority);
  });

  it('ranks exact reservation identifiers above partial matches', () => {
    const exactReservation = reservationRank('RSV-00003', 'RSV-00003', 'Maria Rao');
    const partialGroup = groupBookingRank('RSV-00003', 'GRP-00003', 'RSV-00003 wedding');

    expect(exactReservation.isExactMatch).toBe(true);
    expect(exactReservation.priority).toBeGreaterThan(partialGroup.priority);
  });

  it('orders exact, prefix, and partial matches by relevance', () => {
    const exact = groupBookingRank('Summit', 'GRP-01000', 'Summit');
    const prefix = groupBookingRank('Summit', 'GRP-01001', 'Summit East');
    const partial = groupBookingRank('Summit', 'GRP-01002', 'Annual Summit');

    expect(exact.priority).toBeGreaterThan(prefix.priority);
    expect(prefix.priority).toBeGreaterThan(partial.priority);
  });

  it('detects exact matches case-insensitively', () => {
    const rank = groupBookingRank('grp-00003', 'GRP-00003', 'Conference Block');

    expect(rank.isExactMatch).toBe(true);
  });
});
