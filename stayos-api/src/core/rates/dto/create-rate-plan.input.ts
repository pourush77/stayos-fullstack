import { RatePlanStatus } from '../domain/rate-plan-status.enum';

export interface CreateRatePlanInput {
  code: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  status?: RatePlanStatus;
}
