import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const bookingsPageSource = fs.readFileSync(
  path.join(root, 'src/features/reservations/BookingsPage.tsx'),
  'utf8',
);
const bookingsPageCssSource = fs.readFileSync(
  path.join(root, 'src/features/reservations/BookingsPage.module.css'),
  'utf8',
);
const useBookingsSource = fs.readFileSync(
  path.join(root, 'src/features/reservations/hooks/useBookings.ts'),
  'utf8',
);
const bookingTypesSource = fs.readFileSync(
  path.join(root, 'src/features/reservations/types/booking.types.ts'),
  'utf8',
);
const reservationWorkflowSource = fs.readFileSync(
  path.join(
    root,
    '../../stayos-api/src/core/reservations/services/reservation-workflow.service.ts',
  ),
  'utf8',
);

test('bookings page no longer renders a separate groups strip', () => {
  assert.doesNotMatch(bookingsPageSource, /function CompactGroupsStrip/);
  assert.doesNotMatch(bookingsPageSource, /<CompactGroupsStrip/);
  assert.doesNotMatch(bookingsPageSource, /data-testid="groups-summary-strip"/);
  assert.doesNotMatch(bookingsPageSource, /data-testid="groups-summary-toggle"/);
  assert.doesNotMatch(bookingsPageSource, /data-testid="groups-compact-list"/);
  assert.doesNotMatch(bookingsPageSource, /areGroupsExpanded/);
  assert.doesNotMatch(bookingsPageSource, /setAreGroupsExpanded/);
});

test('group bookings are still included in main bookings list search results', () => {
  assert.match(bookingsPageSource, /const visibleGroupBookings = useMemo/);
  assert.match(
    bookingsPageSource,
    /\.\.\.groupHolds\.map\(\(group\) => \(\{ kind: 'hold' as const, group \}\)\)/,
  );
  assert.match(
    bookingsPageSource,
    /\.\.\.recentlyDepartedGroups\.map\(\(group\) => \(\{ kind: 'hold' as const, group \}\)\)/,
  );
  assert.match(
    bookingsPageSource,
    /\.\.\.inHouseGroups\.map\(\(group\) => \(\{ kind: 'inHouse' as const, group \}\)\)/,
  );
  assert.match(
    bookingsPageSource,
    /groupResultSearchText\(result\)\.toLowerCase\(\)\.includes\(normalized\)/,
  );
  assert.match(bookingsPageSource, /const visibleRows = useMemo/);
  assert.match(bookingsPageSource, /\.\.\.visibleGroupBookings\.map\(\(result\) => \(\{/);
  assert.match(bookingsPageSource, /data-testid=\{`group-booking-row-\$\{id\}`\}/);
});

test('main group rows retain group navigation and operations', () => {
  assert.match(bookingsPageSource, />\s*Open Group\s*</);
  assert.match(bookingsPageSource, />\s*Group Hub\s*</);
  assert.match(bookingsPageSource, />\s*Open Folio\s*</);
  assert.match(bookingsPageSource, />\s*Extend Stay\s*</);
  assert.match(bookingsPageSource, />\s*Check Out Group\s*</);
  assert.match(
    bookingsPageSource,
    /extendGroupStay\(activePropertyId, extendGroup\.groupBookingId/,
  );
  assert.match(
    bookingsPageSource,
    /completeGroupCheckout\(activePropertyId, checkoutGroup\.groupBookingId\)/,
  );
  assert.match(
    bookingsPageSource,
    /getGroupMasterFolio\(activePropertyId, group\.groupBookingId\)/,
  );
});

test('group rows use subtle visual identity inside the main bookings table', () => {
  assert.match(bookingsPageSource, /className=\{styles\.groupRow\}/);
  assert.match(bookingsPageSource, /<Table\.Td className=\{styles\.leadCell\}>/);
  assert.match(bookingsPageSource, />\s*\[GRP\]\s*</);
});

test('group row copy hierarchy keeps group name primary and code lead metadata secondary', () => {
  assert.match(bookingsPageSource, /fw=\{800\}\s*c="#101828"[\s\S]*\{group\.groupName\}/);
  assert.match(
    bookingsPageSource,
    /<Text className=\{styles\.secondaryText\} size="xs">\s*\{group\.groupCode\}/,
  );
  assert.match(bookingsPageSource, /Lead: \$\{group\.leadName\}/);
});

test('bookings table uses consolidated scannable columns', () => {
  assert.match(bookingsPageSource, /'Guest \/ Booking'/);
  assert.match(bookingsPageSource, /'Stay'/);
  assert.match(bookingsPageSource, /'Room \/ Accommodation'/);
  assert.match(bookingsPageSource, /'Status & Payment'/);
  assert.match(bookingsPageSource, /'Action'/);
  assert.doesNotMatch(bookingsPageSource, /'Booking ID',/);
  assert.doesNotMatch(bookingsPageSource, /'Stay Dates'/);
  assert.doesNotMatch(bookingsPageSource, /'Room Type'/);
  assert.doesNotMatch(bookingsPageSource, /'Next Action'/);
});

test('individual rows consolidate booking metadata and room assignment state', () => {
  assert.match(bookingsPageSource, /\{booking\.bookingId\}[\s\S]*sourceLabel\(booking\.source\)/);
  assert.match(bookingsPageSource, /\{booking\.roomType\} - \{booking\.room\}/);
  assert.match(bookingsPageSource, /label: 'Needs room'/);
  assert.match(
    bookingsPageSource,
    /<BookingStatusBadge status=\{booking\.status\} \/>[\s\S]*<PaymentStatusBadge status=\{booking\.paymentStatus\} \/>/,
  );
});

test('individual rows use one contextual primary action and a kebab menu', () => {
  assert.match(bookingsPageSource, /function primaryBookingActionLabel\(booking: Booking\)/);
  assert.match(bookingsPageSource, /if \(booking\.status === 'CHECKED_OUT'\) return 'View Stay'/);
  assert.match(bookingsPageSource, /return nextAction\(booking\)/);
  assert.match(
    bookingsPageSource,
    /if \(booking\.status === 'CONFIRMED' && booking\.room === 'Unassigned'\) return 'Assign Room'/,
  );
  assert.match(
    bookingsPageSource,
    /if \(booking\.status === 'CONFIRMED' && booking\.roomReadyForCheckIn === false\)[\s\S]*return 'Room Not Ready'/,
  );
  assert.match(
    bookingsPageSource,
    /if \(booking\.status === 'CONFIRMED'\) return 'Start Check In'/,
  );
  assert.match(
    bookingsPageSource,
    /if \(booking\.status === 'CHECKED_IN'.*\) \{\s*return 'Check Out';\s*\}/s,
  );
  assert.match(bookingsPageSource, /if \(booking\.status === 'CHECKED_IN'\) return 'Open Stay'/);
  assert.match(
    bookingsPageSource,
    /data-testid=\{`booking-actions-menu-\$\{booking\.backendId\}`\}/,
  );
  assert.match(bookingsPageSource, />\s*View Booking\s*</);
  assert.match(bookingsPageSource, />\s*Edit Booking\s*</);
});

test('individual row menu hides incompatible secondary actions by state', () => {
  assert.match(
    bookingsPageSource,
    /booking\.status === 'CHECKED_OUT' \? \([\s\S]*View Stay History/,
  );
  assert.match(
    bookingsPageSource,
    /booking\.status !== 'CANCELLED' &&[\s\S]*booking\.status !== 'CHECKED_OUT' \? \([\s\S]*Edit Booking/,
  );
});

test('eligible Front Desk arrivals expose Mark No-Show as contextual menu action', () => {
  assert.match(bookingsPageSource, /import \{ NoShowConfirmationModal \}/);
  assert.match(bookingsPageSource, /function canMarkBookingNoShow\(booking: Booking/);
  assert.match(
    bookingsPageSource,
    /\(booking\.status === 'PENDING' \|\| booking\.status === 'CONFIRMED'\) &&[\s\S]*booking\.arrivalDate <= today/,
  );
  assert.match(bookingsPageSource, /canMarkBookingNoShow\(booking\) \? \(/);
  assert.match(bookingsPageSource, /data-testid=\{`booking-mark-no-show-\$\{booking\.backendId\}`\}/);
  assert.match(bookingsPageSource, />\s*Mark No-Show\s*</);
});

test('Front Desk Mark No-Show is hidden for invalid reservation statuses', () => {
  const helperStart = bookingsPageSource.indexOf('function canMarkBookingNoShow');
  const helperEnd = bookingsPageSource.indexOf('function isTodayGroupResult', helperStart);
  const helperSource = bookingsPageSource.slice(helperStart, helperEnd);

  assert.ok(helperStart >= 0);
  assert.ok(helperEnd > helperStart);
  assert.doesNotMatch(helperSource, /CHECKED_IN/);
  assert.doesNotMatch(helperSource, /CHECKED_OUT/);
  assert.doesNotMatch(helperSource, /CANCELLED/);
  assert.doesNotMatch(helperSource, /NO_SHOW/);
});

test('Front Desk No-Show modal uses existing API flow and refreshes bookings after success', () => {
  assert.match(bookingsPageSource, /const \[noShowBooking, setNoShowBooking\] = useState<Booking \| null>\(null\)/);
  assert.match(bookingsPageSource, /reservationId: noShowBooking\.backendId/);
  assert.match(bookingsPageSource, /reservationCode: noShowBooking\.bookingId/);
  assert.match(bookingsPageSource, /propertyId: activePropertyId/);
  assert.match(bookingsPageSource, /onSuccess=\{\(\) => bookingState\.refreshBookings\(\)\}/);
  assert.doesNotMatch(bookingsPageSource, /filter\(\(booking\) => booking\.backendId !==/);
});

test('group rows use Open Group primary action and a state-aware kebab menu', () => {
  assert.match(bookingsPageSource, /data-testid=\{`group-booking-next-action-\$\{id\}`\}/);
  assert.match(bookingsPageSource, />\s*Open Group\s*</);
  assert.match(bookingsPageSource, /data-testid=\{`group-booking-actions-menu-\$\{id\}`\}/);
  assert.match(bookingsPageSource, />\s*Group Hub\s*</);
  assert.match(
    bookingsPageSource,
    /result\.kind === 'inHouse' \? \([\s\S]*Open Folio[\s\S]*Extend Stay[\s\S]*Check Out Group/,
  );
  assert.match(
    bookingsPageSource,
    /result\.kind === 'hold' && result\.group\.status === 'CHECKED_OUT' \? \([\s\S]*Open Folio/,
  );
});

test('bookings load room board data as a non-fatal readiness hint', () => {
  assert.match(
    useBookingsSource,
    /getRoomBoard\(propertyId, signal\)\.catch\(\(\) => \[\] as OperationsRoomBoardItemDto\[\]\)/,
  );
  assert.match(
    useBookingsSource,
    /enrichBookingsWithRoomReadiness\(\s*reservationDtos\.map\(mapBooking\),\s*roomBoard,\s*\)/,
  );
  assert.match(
    useBookingsSource,
    /const roomsById = new Map\(rooms\.map\(\(room\) => \[room\.roomId, room\]\)\)/,
  );
  assert.match(useBookingsSource, /roomsById\.get\(booking\.roomId\)\?\.operationalStatus/);
});

test('booking display model carries transient room readiness only', () => {
  assert.match(bookingTypesSource, /roomOperationalStatus\?: RoomOperationalStatus/);
  assert.match(bookingTypesSource, /roomReadinessLabel\?: RoomReadinessLabel/);
  assert.match(bookingTypesSource, /roomReadyForCheckIn\?: boolean/);
  assert.match(
    bookingTypesSource,
    /export type RoomReadinessLabel = 'Ready' \| 'Cleaning' \| 'Inspection' \| 'Not ready'/,
  );
});

test('room readiness labels map backend operational statuses for individual rows', () => {
  assert.match(
    useBookingsSource,
    /normalized === 'READY'[\s\S]*roomReadinessLabel: 'Ready'[\s\S]*roomReadyForCheckIn: true/,
  );
  assert.match(
    useBookingsSource,
    /normalized === 'NEEDS_CLEANING'[\s\S]*roomReadinessLabel: 'Cleaning'[\s\S]*roomReadyForCheckIn: false/,
  );
  assert.match(
    useBookingsSource,
    /normalized === 'INSPECTION'[\s\S]*roomReadinessLabel: 'Inspection'[\s\S]*roomReadyForCheckIn: false/,
  );
  assert.match(useBookingsSource, /normalized === 'OCCUPIED'[\s\S]*roomReadyForCheckIn: false/);
  assert.doesNotMatch(
    useBookingsSource,
    /normalized === 'OCCUPIED'[\s\S]*roomReadinessLabel: 'Ready'/,
  );
  assert.match(
    useBookingsSource,
    /normalized === 'MAINTENANCE' \|\|[\s\S]*normalized === 'OUT_OF_SERVICE' \|\|[\s\S]*normalized === 'OUT_OF_ORDER'[\s\S]*roomReadinessLabel: 'Not ready'[\s\S]*roomReadyForCheckIn: false/,
  );
  assert.match(bookingTypesSource, /'MAINTENANCE'/);
  assert.match(bookingTypesSource, /'OUT_OF_SERVICE'/);
  assert.match(bookingTypesSource, /'OUT_OF_ORDER'/);
});

test('room readiness is shown only for assigned pre-check-in individual bookings', () => {
  assert.match(
    useBookingsSource,
    /if \(!booking\.roomId \|\| booking\.room === 'Unassigned'\) return booking/,
  );
  assert.match(
    bookingsPageSource,
    /booking\.roomReadinessLabel && booking\.status !== 'CHECKED_IN'/,
  );
  assert.match(bookingsPageSource, /roomReadinessClassName\(booking\.roomReadinessLabel\)/);
  assert.match(bookingsPageSource, /styles\.roomReadinessReady/);
  assert.match(bookingsPageSource, /styles\.roomReadinessWarning/);
  assert.match(bookingsPageSource, /styles\.roomReadinessNotReady/);
  assert.match(bookingsPageSource, /label: 'Needs room'/);
});

test('destructive group action stays separated and uses existing checkout handler', () => {
  assert.match(
    bookingsPageSource,
    /<Menu\.Divider \/>[\s\S]*<Menu\.Item\s+color="red"[\s\S]*onClick=\{\(\) => void openCheckoutGroup\(result\.group\)\}/,
  );
  assert.match(
    bookingsPageSource,
    /completeGroupCheckout\(activePropertyId, checkoutGroup\.groupBookingId\)/,
  );
});

test('bookings page renders compact operational summary cards above filters', () => {
  assert.match(bookingsPageSource, /data-testid="bookings-summary-cards"/);
  assert.match(bookingsPageSource, /label: 'Arriving Today'/);
  assert.match(bookingsPageSource, /label: 'In-House'/);
  assert.match(bookingsPageSource, /label: 'Departing Today'/);
  assert.match(bookingsPageSource, /label: 'Needs Attention'/);
  assert.match(bookingsPageSource, /className=\{\[[\s\S]*styles\.summaryCard/);
  assert.doesNotMatch(bookingsPageSource, /bookings-summary-cards[\s\S]*linear-gradient/);
});

test('operational summary counts are derived from loaded bookings and group entities', () => {
  assert.match(bookingsPageSource, /const operationalSummary = useMemo/);
  assert.match(bookingsPageSource, /arrivingBookings\.length \+ arrivingGroups\.length/);
  assert.match(bookingsPageSource, /inHouseBookings\.length \+ inHouseGroups\.length/);
  assert.match(bookingsPageSource, /departingBookings\.length \+ departingGroups\.length/);
  assert.match(
    bookingsPageSource,
    /actionableUnassignedBookings\.length \+ attentionGroups\.length/,
  );
  assert.match(
    bookingsPageSource,
    /inHouseGroups\.reduce\(\(sum, group\) => sum \+ group\.roomCount, 0\)/,
  );
});

test('operational summary cards filter arrivals, in-house, departures, and selected state', () => {
  assert.match(bookingsPageSource, /filter: 'arrivals-today' as const/);
  assert.match(bookingsPageSource, /filter: 'checked-in' as const/);
  assert.match(bookingsPageSource, /filter: 'departures-today' as const/);
  assert.match(
    bookingsPageSource,
    /const setOperationalFilter = \(targetFilter: BookingFilter\) => \{/,
  );
  assert.match(bookingsPageSource, /current === targetFilter \? 'all' : targetFilter/);
  assert.match(bookingsPageSource, /aria-pressed=\{isSelected\}/);
  assert.match(bookingsPageSource, /const summaryToneByFilter/);
  assert.match(bookingsPageSource, /'arrivals-today': \{[\s\S]*colors\.semantic\.info/);
  assert.match(bookingsPageSource, /'checked-in': \{[\s\S]*colors\.semantic\.success/);
  assert.match(bookingsPageSource, /'departures-today': \{[\s\S]*colors\.semantic\.warning/);
  assert.match(bookingsPageSource, /borderTopColor: isSelected \? tone\.color/);
  assert.match(bookingsPageSource, /borderRightColor: isSelected \? tone\.color/);
  assert.match(bookingsPageSource, /borderBottomColor: isSelected \? tone\.color/);
  assert.match(bookingsPageSource, /borderLeftColor: tone\.color/);
  assert.doesNotMatch(bookingsPageSource, /borderColor: isSelected \? tone\.color/);
  assert.match(bookingsPageSource, /color: tone\.color/);
  assert.match(
    bookingsPageSource,
    /background: isSelected[\s\S]*color-mix\(in srgb, \$\{tone\.soft\} 46%, #ffffff\)/,
  );
  assert.doesNotMatch(bookingsPageSource, />\s*Selected\s*</);
});

test('unassigned individual bookings use calm and urgent warning states by lifecycle', () => {
  assert.match(bookingsPageSource, /function unassignedWarningState/);
  assert.match(
    bookingsPageSource,
    /booking\.status === 'CHECKED_IN'[\s\S]*styles\.unassignedWarningUrgent[\s\S]*Unassigned in-house/,
  );
  assert.match(bookingsPageSource, /styles\.unassignedWarning[\s\S]*Needs room/);
  assert.match(bookingsPageSource, /const warningState = unassignedWarningState\(booking\)/);
  assert.match(bookingsPageSource, /<AlertCircle aria-hidden="true" size=\{12\} \/>/);
  assert.match(bookingsPageSource, /\{warningState\.label\}/);
});

test('needs attention uses existing reliable assignment-needed conditions only', () => {
  assert.match(bookingsPageSource, /export function isActionableUnassignedBooking/);
  assert.match(bookingsPageSource, /booking\.status === 'PENDING'/);
  assert.match(bookingsPageSource, /booking\.status === 'CONFIRMED'/);
  assert.match(bookingsPageSource, /booking\.status === 'CHECKED_IN'/);
  assert.doesNotMatch(
    bookingsPageSource,
    /booking\.room === 'Unassigned' && booking\.status !== 'CANCELLED'/,
  );
  assert.match(bookingsPageSource, /function hasGroupAttention\(group: GroupHoldDto\)/);
  assert.match(
    bookingsPageSource,
    /group\.status === 'CONFIRMED' && group\.roomAssignments\.length === 0/,
  );
  assert.match(bookingsPageSource, /if \(filter === 'needs-attention'\)/);
});

test('terminal unassigned bookings do not produce room-assignment attention', () => {
  const helperStart = bookingsPageSource.indexOf('export function isActionableUnassignedBooking');
  const helperEnd = bookingsPageSource.indexOf('function hasBookingAttention', helperStart);
  const helperSource = bookingsPageSource.slice(helperStart, helperEnd);

  assert.ok(helperStart >= 0);
  assert.ok(helperEnd > helperStart);
  assert.match(
    bookingsPageSource,
    /if \(filter === 'unassigned'\) return isActionableUnassignedBooking\(booking\)/,
  );
  assert.match(
    bookingsPageSource,
    /if \(filter === 'needs-attention'\) return hasBookingAttention\(booking\)/,
  );
  assert.match(bookingsPageSource, /const warningState = unassignedWarningState\(booking\)/);
  assert.doesNotMatch(
    bookingsPageSource,
    /\{booking\.room === 'Unassigned' \? \([\s\S]*Needs room/,
  );
  assert.doesNotMatch(helperSource, /CHECKED_OUT/);
  assert.doesNotMatch(helperSource, /CANCELLED/);
  assert.doesNotMatch(helperSource, /NO_SHOW/);
});

test('header summary avoids duplicating operational attention counts', () => {
  assert.match(bookingsPageSource, /const visibleBookingCount = visibleRows\.length/);
  assert.match(
    bookingsPageSource,
    /\{visibleBookingCount\} \{filter === 'all' \? 'bookings' : 'shown'\}/,
  );
  assert.doesNotMatch(
    bookingsPageSource,
    /bookingState\.bookings\.filter\(\(booking\) => booking\.room === 'Unassigned'\)\.length/,
  );
  assert.doesNotMatch(bookingsPageSource, /unassigned\s*<\/Text>/);
});

test('confirmed group holds with zero assignments still contribute to attention filters', () => {
  assert.match(
    bookingsPageSource,
    /if \(filter === 'unassigned'\) return hasGroupAttention\(group\)/,
  );
  assert.match(
    bookingsPageSource,
    /if \(filter === 'needs-attention'\) return hasGroupAttention\(group\)/,
  );
  assert.match(
    bookingsPageSource,
    /const attentionGroups = activeGroupHolds\.filter\(hasGroupAttention\)/,
  );
});

test('summary group counts use one group entity and avoid rooming-list child double counting', () => {
  assert.match(
    bookingsPageSource,
    /activeGroupHolds\.filter\(\(group\) => group\.arrivalDate === today\)/,
  );
  assert.match(
    bookingsPageSource,
    /inHouseGroups\.filter\(\(group\) => group\.departureDate === today\)/,
  );
  assert.doesNotMatch(bookingsPageSource, /operationalSummary[\s\S]*roomingList\.length/);
});

test('existing list search and filter controls still render after summary cards', () => {
  assert.match(
    bookingsPageSource,
    /placeholder="Search guest, booking ID, phone, room type or source\.\.\."/,
  );
  assert.match(bookingsPageSource, /data=\{bookingFilterOptions\}/);
  assert.match(bookingsPageSource, /value=\{filter\}/);
  assert.match(
    bookingsPageSource,
    /onChange=\{\(value\) => setFilter\(\(value as BookingFilter \| null\) \?\? 'all'\)\}/,
  );
});

test('compact operational tabs render and reuse summary-card filter state', () => {
  assert.match(bookingsPageSource, /data-testid="bookings-operational-tabs"/);
  assert.match(bookingsPageSource, /label: 'All'/);
  assert.match(bookingsPageSource, /label: 'Arriving'/);
  assert.match(bookingsPageSource, /label: 'In-House'/);
  assert.match(bookingsPageSource, /label: 'Departing'/);
  assert.match(bookingsPageSource, /label: 'Upcoming'/);
  assert.match(bookingsPageSource, /label: 'Groups'/);
  assert.match(bookingsPageSource, /label: 'Needs Attention'/);
  assert.match(bookingsPageSource, /onClick=\{\(\) => setOperationalFilter\(tab\.filter\)\}/);
  assert.match(bookingsPageSource, /onClick=\{\(\) => setOperationalFilter\(item\.filter\)\}/);
});

test('groups tab isolates group parent rows without expanding children', () => {
  assert.match(bookingsPageSource, /if \(filter === 'groups'\) return false/);
  assert.match(bookingsPageSource, /if \(filter === 'groups'\) return true/);
  assert.match(bookingsPageSource, /filter === 'groups'/);
  assert.doesNotMatch(bookingsPageSource, /roomingList\.map/);
  assert.doesNotMatch(bookingsPageSource, /children\.map/);
});

test('upcoming scope excludes terminal historical records', () => {
  assert.match(bookingsPageSource, /function isTerminalBookingStatus/);
  assert.match(
    bookingsPageSource,
    /status === 'CHECKED_OUT' \|\| status === 'CANCELLED' \|\| status === 'NO_SHOW'/,
  );
  assert.match(bookingsPageSource, /function isTerminalGroupStatus/);
  assert.match(
    bookingsPageSource,
    /status === 'CHECKED_OUT' \|\| status === 'CANCELLED' \|\| status === 'RELEASED'/,
  );
  assert.match(
    bookingsPageSource,
    /booking\.arrivalDate > today && !isTerminalBookingStatus\(booking\.status\)/,
  );
  assert.match(
    bookingsPageSource,
    /group\.arrivalDate > today && !isTerminalGroupStatus\(group\.status\)/,
  );
});

test('default ordering prioritizes operational rows and search preserves source relevance order', () => {
  assert.match(bookingsPageSource, /function operationalRank\(row: BookingListRow\)/);
  assert.match(bookingsPageSource, /function rowChronologyValue\(row: BookingListRow\)/);
  assert.match(
    bookingsPageSource,
    /row\.booking\.createdAt \?\? \(rank === 4 \? row\.booking\.departureDate : row\.booking\.arrivalDate\)/,
  );
  assert.match(
    bookingsPageSource,
    /groupResultCreatedAt\(row\.result\) \|\|[\s\S]*rank === 4 \? row\.result\.group\.departureDate : row\.result\.group\.arrivalDate/,
  );
  assert.match(
    bookingsPageSource,
    /booking\.status === 'CHECKED_IN' && hasBookingAttention\(booking\)\) return 1/,
  );
  assert.match(
    bookingsPageSource,
    /isActionableUnassignedBooking\(booking\) && booking\.arrivalDate === today\) return 2/,
  );
  assert.match(
    bookingsPageSource,
    /booking\.arrivalDate === today && !isTerminalBookingStatus\(booking\.status\)\) return 3/,
  );
  assert.match(
    bookingsPageSource,
    /booking\.status === 'CHECKED_IN' && booking\.departureDate === today\) return 4/,
  );
  assert.match(bookingsPageSource, /if \(booking\.status === 'CHECKED_IN'\) return 5/);
  assert.match(bookingsPageSource, /if \(isUpcomingBooking\(booking, today\)\) return 6/);
  assert.match(bookingsPageSource, /if \(!isTerminalBookingStatus\(booking\.status\)\) return 7/);
  assert.match(bookingsPageSource, /return 8/);
  assert.match(
    bookingsPageSource,
    /const scopedRows = rows\.filter\(\(row\) => rowMatchesDateScope\(row, dateScope\)\)/,
  );
  assert.match(
    bookingsPageSource,
    /return query\.trim\(\) \? scopedRows : sortOperationalRows\(scopedRows\)/,
  );
  assert.match(
    bookingsPageSource,
    /const dateDelta = rightRelevantDate\.localeCompare\(leftRelevantDate\)/,
  );
});

test('default ordering keeps other in-house rows before upcoming active rows', () => {
  assert.match(bookingsPageSource, /if \(booking\.status === 'CHECKED_IN'\) return 5/);
  assert.match(bookingsPageSource, /if \(isUpcomingBooking\(booking, today\)\) return 6/);
  assert.match(bookingsPageSource, /if \(status === 'CHECKED_IN'\) return 5/);
  assert.match(bookingsPageSource, /if \(result\.kind === 'hold' && isUpcomingGroupHold\(result\.group, today\)\) return 6/);
});

test('chronology applies inside equal operational rank without guest-name sorting', () => {
  assert.match(bookingsPageSource, /const rank = operationalRank\(row\)/);
  assert.match(
    bookingsPageSource,
    /row\.booking\.createdAt \?\? \(rank === 4 \? row\.booking\.departureDate : row\.booking\.arrivalDate\)/,
  );
  assert.match(
    bookingsPageSource,
    /groupResultCreatedAt\(row\.result\) \|\|[\s\S]*rank === 4 \? row\.result\.group\.departureDate : row\.result\.group\.arrivalDate/,
  );
  assert.match(
    bookingsPageSource,
    /const dateDelta = rightRelevantDate\.localeCompare\(leftRelevantDate\)/,
  );
  assert.match(bookingsPageSource, /return rowTieBreaker\(left\)\.localeCompare\(rowTieBreaker\(right\)\)/);
  assert.doesNotMatch(bookingsPageSource, /guestName\.localeCompare/);
});

test('checked-in unassigned keeps safe Open Stay CTA because backend assignment excludes checked-in', () => {
  assert.match(
    reservationWorkflowSource,
    /private ensureReservationAssignable\(reservation: ReservationEntity\): void \{[\s\S]*ReservationStatus\.PENDING[\s\S]*ReservationStatus\.CONFIRMED[\s\S]*includes\(reservation\.status\)/,
  );
  assert.doesNotMatch(
    reservationWorkflowSource,
    /private ensureReservationAssignable\(reservation: ReservationEntity\): void \{[\s\S]*ReservationStatus\.CHECKED_IN[\s\S]*includes\(reservation\.status\)/,
  );
  assert.match(
    reservationWorkflowSource,
    /Only pending or confirmed reservations can be assigned a room/,
  );
  assert.match(
    bookingsPageSource,
    /if \(booking\.status === 'CONFIRMED' && booking\.room === 'Unassigned'\) return 'Assign Room'/,
  );
  assert.match(bookingsPageSource, /if \(booking\.status === 'CHECKED_IN'\) return 'Open Stay'/);
  assert.doesNotMatch(
    bookingsPageSource,
    /booking\.status === 'CHECKED_IN' && booking\.room === 'Unassigned'[\s\S]*return 'Assign Room'/,
  );
});

test('date scope controls render compact today upcoming and all-dates choices', () => {
  assert.match(bookingsPageSource, /type DateScope = 'today' \| 'upcoming' \| 'all-dates'/);
  assert.match(bookingsPageSource, /data-testid="bookings-date-scope-controls"/);
  assert.match(bookingsPageSource, /label: 'Today', value: 'today'/);
  assert.match(bookingsPageSource, /label: 'Upcoming', value: 'upcoming'/);
  assert.match(bookingsPageSource, /label: 'All Dates', value: 'all-dates'/);
  assert.match(bookingsPageSource, /data-testid=\{`bookings-date-scope-\$\{scope\.value\}`\}/);
});

test('today and all-dates date scopes use existing local date semantics', () => {
  assert.match(
    bookingsPageSource,
    /function isTodayBooking\(booking: Booking, today = dateKey\(new Date\(\)\)\)/,
  );
  assert.match(
    bookingsPageSource,
    /if \(isTerminalBookingStatus\(booking\.status\)\) return false/,
  );
  assert.match(
    bookingsPageSource,
    /return booking\.arrivalDate === today \|\| booking\.status === 'CHECKED_IN'/,
  );
  assert.match(
    bookingsPageSource,
    /function isTodayGroupResult\(result: GroupBookingResult, today = dateKey\(new Date\(\)\)\)/,
  );
  assert.match(
    bookingsPageSource,
    /return result\.group\.arrivalDate <= today && result\.group\.departureDate >= today/,
  );
  assert.match(bookingsPageSource, /if \(dateScope === 'all-dates'\) return true/);
});

test('pagination is applied to unified individual and group rows', () => {
  assert.match(bookingsPageSource, /const \[pageSize, setPageSize\] = useState\(initialPageSize\)/);
  assert.match(
    bookingsPageSource,
    /const \[currentPage, setCurrentPage\] = useState\(initialPage\)/,
  );
  assert.match(bookingsPageSource, /const paginatedRows = useMemo/);
  assert.match(bookingsPageSource, /return visibleRows\.slice\(start, start \+ pageSize\)/);
  assert.match(bookingsPageSource, /\{paginatedRows\.map\(\(row\) => \{/);
  assert.match(bookingsPageSource, /kind: 'group' as const/);
  assert.doesNotMatch(bookingsPageSource, /roomingList\.length/);
});

test('rows per page and pagination controls render with reliable loaded totals', () => {
  assert.match(bookingsPageSource, /const pageSizeOptions = \[/);
  assert.match(bookingsPageSource, /value: '10'/);
  assert.match(bookingsPageSource, /value: '25'/);
  assert.match(bookingsPageSource, /value: '50'/);
  assert.match(bookingsPageSource, /aria-label="Rows per page"/);
  assert.match(bookingsPageSource, /data-testid="bookings-pagination"/);
  assert.match(
    bookingsPageSource,
    /Showing \{firstRowNumber\}-\{lastRowNumber\} of \{visibleRows\.length\}/,
  );
  assert.match(bookingsPageSource, /data-testid="bookings-pagination-prev"/);
  assert.match(bookingsPageSource, /data-testid="bookings-pagination-next"/);
  assert.match(bookingsPageSource, /className=\{styles\.paginationControl\}/);
  assert.match(
    bookingsPageSource,
    /onClick=\{\(\) => setCurrentPage\(\(page\) => Math\.max\(1, page - 1\)\)\}/,
  );
  assert.match(
    bookingsPageSource,
    /onClick=\{\(\) => setCurrentPage\(\(page\) => Math\.min\(totalPages, page \+ 1\)\)\}/,
  );
});

test('toolbar scope dropdown no longer renders a visible scope prefix', () => {
  assert.match(bookingsPageSource, /aria-label="Scope"/);
  assert.doesNotMatch(bookingsPageSource, />\s*Scope:\s*</);
  assert.doesNotMatch(bookingsPageSource, /styles\.scopeInput/);
});

test('filter search date-scope and page-size changes reset pagination to page one', () => {
  assert.match(bookingsPageSource, /const didHydrateListState = useRef\(false\)/);
  assert.match(
    bookingsPageSource,
    /if \(!didHydrateListState\.current\) \{[\s\S]*didHydrateListState\.current = true;[\s\S]*return;[\s\S]*\}[\s\S]*setCurrentPage\(1\);[\s\S]*\}, \[dateScope, filter, pageSize, query\]\)/,
  );
  assert.match(
    bookingsPageSource,
    /onChange=\{\(event\) => setQuery\(event\.currentTarget\.value\)\}/,
  );
  assert.match(bookingsPageSource, /onClick=\{\(\) => setDateScope\(scope\.value\)\}/);
  assert.match(bookingsPageSource, /onClick=\{\(\) => setOperationalFilter\(tab\.filter\)\}/);
  assert.match(bookingsPageSource, /onClick=\{\(\) => setOperationalFilter\(item\.filter\)\}/);
});

test('bookings list state is preserved in the URL and scroll position is restored locally', () => {
  assert.match(bookingsPageSource, /usePathname, useRouter, useSearchParams/);
  assert.match(bookingsPageSource, /params\.set\('q', query\)/);
  assert.match(bookingsPageSource, /params\.set\('filter', filter\)/);
  assert.match(bookingsPageSource, /params\.set\('dateScope', dateScope\)/);
  assert.match(bookingsPageSource, /params\.set\('pageSize', String\(pageSize\)\)/);
  assert.match(bookingsPageSource, /params\.set\('page', String\(currentPage\)\)/);
  assert.match(bookingsPageSource, /router\.replace\(nextUrl, \{ scroll: false \}\)/);
  assert.match(bookingsPageSource, /sessionStorage\.setItem\('stayos\.reservations\.scrollY'/);
  assert.match(bookingsPageSource, /sessionStorage\.getItem\('stayos\.reservations\.scrollY'/);
});

test('clear filters and active filter context restore the default bookings view', () => {
  assert.match(bookingsPageSource, /const defaultBookingsView = \{/);
  assert.match(bookingsPageSource, /const hasActiveFilters =/);
  assert.match(bookingsPageSource, /data-testid="bookings-active-filter-context"/);
  assert.match(bookingsPageSource, /data-testid="bookings-clear-filters"/);
  assert.match(bookingsPageSource, /setQuery\(defaultBookingsView\.query\)/);
  assert.match(bookingsPageSource, /setFilter\(defaultBookingsView\.filter\)/);
  assert.match(bookingsPageSource, /setDateScope\(defaultBookingsView\.dateScope\)/);
  assert.match(bookingsPageSource, /setPageSize\(defaultBookingsView\.pageSize\)/);
  assert.match(bookingsPageSource, /setCurrentPage\(defaultBookingsView\.page\)/);
});

test('bookings empty states are contextual and offer clear filters', () => {
  assert.match(bookingsPageSource, /No bookings match/);
  assert.match(bookingsPageSource, /No arrivals found for this view\./);
  assert.match(bookingsPageSource, /No group bookings found\./);
  assert.match(bookingsPageSource, /Nothing needs attention right now\./);
  assert.match(bookingsPageSource, /data-testid="bookings-empty-clear-filters"/);
});

test('bookings controls stay sticky while the table header remains in normal flow', () => {
  assert.match(bookingsPageSource, /className=\{styles\.stickyToolbar\}/);
  assert.match(bookingsPageCssSource, /\.stickyToolbar \{/);
  assert.doesNotMatch(bookingsPageCssSource, /\.tableHeader \{[^}]*position: sticky;/);
  assert.doesNotMatch(bookingsPageCssSource, /\.tableHeader \{[^}]*top:/);
  assert.doesNotMatch(bookingsPageCssSource, /\.tableHeader \{[^}]*z-index:/);
});

test('quick copy utilities are available from existing row action menus', () => {
  assert.match(bookingsPageSource, /const copyToClipboard = async/);
  assert.match(bookingsPageSource, /navigator\.clipboard\.writeText\(value\)/);
  assert.match(bookingsPageSource, /\`\$\{label\} copied\`/);
  assert.match(bookingsPageSource, /Copy Booking ID/);
  assert.match(bookingsPageSource, /Copy Group ID/);
  assert.match(bookingsPageSource, /Copy Phone/);
});

test('pagination avoids duplicate rows by slicing the sorted scoped unified list', () => {
  assert.match(
    bookingsPageSource,
    /const totalPages = Math\.max\(1, Math\.ceil\(visibleRows\.length \/ pageSize\)\)/,
  );
  assert.match(bookingsPageSource, /const activePage = Math\.min\(currentPage, totalPages\)/);
  assert.match(bookingsPageSource, /const start = \(activePage - 1\) \* pageSize/);
  assert.match(bookingsPageSource, /key=\{`group-\$\{id\}`\}/);
  assert.match(bookingsPageSource, /key=\{booking\.backendId\}/);
});
