export interface CreateDailyRateInput {
  roomTypeId: string;
  ratePlanId: string;
  /** ISO date string (YYYY-MM-DD). */
  stayDate: string;
  /** Monetary amount as a decimal string, e.g. "5000.00". */
  amount: string;
}
