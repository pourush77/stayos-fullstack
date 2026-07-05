export function parseDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDisplayDate(value: string) {
  const date = parseDate(value);
  if (!date) return 'Not recorded';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function calculateNights(arrivalDate: string, departureDate: string) {
  const arrival = parseDate(arrivalDate);
  const departure = parseDate(departureDate);
  if (!arrival || !departure) return 0;
  return Math.max(0, Math.round((departure.getTime() - arrival.getTime()) / 86_400_000));
}

export function calculateRemainingNights(departureDate: string) {
  const departure = parseDate(departureDate);
  if (!departure) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((departure.getTime() - today.getTime()) / 86_400_000));
}
