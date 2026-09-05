import type { StayFinancialState, StayPaymentStatus } from '../types/stay.types';

export function financialStateFromBalance(balance: number): StayFinancialState {
  if (balance > 0) return 'BALANCE_DUE';
  if (balance < 0) return 'CREDIT_DUE';
  return 'CLEAR';
}

export function paymentLabelForFinancialState(
  financialState: StayFinancialState,
): StayPaymentStatus {
  if (financialState === 'CLEAR') return 'Paid';
  if (financialState === 'CREDIT_DUE') return 'Credit / Refund Due';
  return 'Payment Due';
}
