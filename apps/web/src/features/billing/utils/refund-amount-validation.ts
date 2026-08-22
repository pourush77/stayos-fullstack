export type RefundAmountValidationResult =
  | { valid: true; amountCents: number }
  | { valid: false; message: string };

export function parseMoneyCents(value: string | number | null | undefined): number | null {
  const text = String(value ?? '').trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) {
    return null;
  }

  const sign = text.startsWith('-') ? -1 : 1;
  const unsigned = sign === -1 ? text.slice(1) : text;
  const [rupees, paise = ''] = unsigned.split('.');
  const rupeeCents = Number(rupees) * 100;
  const paiseCents = Number(paise.padEnd(2, '0'));

  if (!Number.isSafeInteger(rupeeCents) || !Number.isSafeInteger(paiseCents)) {
    return null;
  }

  return sign * (rupeeCents + paiseCents);
}

export function validateRefundAmount(
  amount: string | number | null | undefined,
  remainingRefundable: string | number,
  formattedRemaining: string,
): RefundAmountValidationResult {
  const amountCents = parseMoneyCents(amount);
  if (amountCents === null) {
    return { valid: false, message: 'Enter a valid refund amount.' };
  }

  if (amountCents <= 0) {
    return { valid: false, message: 'Refund amount must be greater than 0.' };
  }

  const remainingCents = parseMoneyCents(remainingRefundable);
  if (remainingCents === null || amountCents > remainingCents) {
    return { valid: false, message: `Refund amount cannot exceed ${formattedRemaining}.` };
  }

  return { valid: true, amountCents };
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
