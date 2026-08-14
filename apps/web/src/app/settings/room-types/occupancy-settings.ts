export type OccupancyDraft = {
  baseOccupancy: number;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
};

export type OccupancyErrors = Partial<Record<keyof OccupancyDraft, string>>;

export function validateOccupancyDraft(draft: OccupancyDraft): OccupancyErrors {
  const errors: OccupancyErrors = {};

  if (draft.baseOccupancy < 1) {
    errors.baseOccupancy = 'Standard occupancy must be at least 1.';
  }

  if (draft.maxOccupancy < draft.baseOccupancy) {
    errors.maxOccupancy = 'Maximum occupancy must be at least the standard occupancy.';
  }

  if (draft.maxAdults < 1) {
    errors.maxAdults = 'Maximum adults must be at least 1.';
  }

  if (draft.maxChildren < 0) {
    errors.maxChildren = 'Maximum children cannot be negative.';
  }

  if (draft.maxAdults > draft.maxOccupancy) {
    errors.maxAdults = 'Maximum adults cannot exceed maximum occupancy.';
  }

  if (draft.maxChildren > draft.maxOccupancy) {
    errors.maxChildren = 'Maximum children cannot exceed maximum occupancy.';
  }

  return errors;
}

export function hasOccupancyErrors(errors: OccupancyErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function occupancyPreview(draft: OccupancyDraft): string {
  const adultLabel = draft.maxAdults === 1 ? 'adult' : 'adults';
  const childLabel = draft.maxChildren === 1 ? 'child' : 'children';
  const guestLabel = draft.maxOccupancy === 1 ? 'guest' : 'guests';

  return `Allows up to ${draft.maxAdults} ${adultLabel} + ${draft.maxChildren} ${childLabel}, ${draft.maxOccupancy} ${guestLabel} total`;
}
