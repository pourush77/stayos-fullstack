import { RatePlanStatus } from '../domain/rate-plan-status.enum';
import { MealPlan } from '../domain/meal-plan.enum';

export interface CreateRatePlanInput {
  code: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  status?: RatePlanStatus;
  mealPlan?: MealPlan;
  refundable?: boolean;
}

export interface UpdateRatePlanInput {
  name?: string;
  description?: string | null;
  isDefault?: boolean;
  status?: RatePlanStatus;
  mealPlan?: MealPlan;
  refundable?: boolean;
}

export interface UpsertRatePlanRoomTypeInput {
  roomTypeId: string;
  baseOccupancy: number;
  baseRate: string;
  extraAdultCharge?: string;
  extraChildCharge?: string;
}
