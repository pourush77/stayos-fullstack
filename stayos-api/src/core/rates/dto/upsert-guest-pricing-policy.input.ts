import { ChildAgeBandInput } from './child-age-band.input';

export interface UpsertGuestPricingPolicyInput {
  ageBasedChildPricingEnabled?: boolean;
  maximumChildAge: number;
  isActive?: boolean;
  childAgeBands: ChildAgeBandInput[];
}
