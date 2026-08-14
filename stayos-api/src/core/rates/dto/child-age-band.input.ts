import { ChildPricingMode } from '../domain/child-pricing-mode.enum';

export interface ChildAgeBandInput {
  label: string;
  minAge: number;
  maxAge: number;
  pricingMode: ChildPricingMode;
  fixedAmount?: string | null;
  percentage?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}
