import assert from 'node:assert/strict';

const { validateRefundAmount } = await import('./refund-amount-validation.ts');

const remaining = '2000.00';
const formattedRemaining = '₹2,000.00';

assert.equal(validateRefundAmount('500', remaining, formattedRemaining).valid, true);
assert.equal(validateRefundAmount('2000', remaining, formattedRemaining).valid, true);
assert.deepEqual(validateRefundAmount('2001', remaining, formattedRemaining), {
  valid: false,
  message: 'Refund amount cannot exceed ₹2,000.00.',
});
assert.deepEqual(validateRefundAmount('0', remaining, formattedRemaining), {
  valid: false,
  message: 'Refund amount must be greater than 0.',
});
assert.deepEqual(validateRefundAmount('-1', remaining, formattedRemaining), {
  valid: false,
  message: 'Refund amount must be greater than 0.',
});
assert.deepEqual(validateRefundAmount('', remaining, formattedRemaining), {
  valid: false,
  message: 'Enter a valid refund amount.',
});
assert.deepEqual(validateRefundAmount('abc', remaining, formattedRemaining), {
  valid: false,
  message: 'Enter a valid refund amount.',
});

console.log('refund amount validation assertions passed');
