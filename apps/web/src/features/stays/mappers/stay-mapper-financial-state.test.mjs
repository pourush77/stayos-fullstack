import assert from 'node:assert/strict';

const { financialStateFromBalance, paymentLabelForFinancialState } = await import(
  './stay-financial-state.ts'
);

assert.equal(financialStateFromBalance(500), 'BALANCE_DUE');
assert.equal(paymentLabelForFinancialState('BALANCE_DUE'), 'Payment Due');
assert.equal(financialStateFromBalance(0), 'CLEAR');
assert.equal(paymentLabelForFinancialState('CLEAR'), 'Paid');
assert.equal(financialStateFromBalance(-200), 'CREDIT_DUE');
assert.equal(paymentLabelForFinancialState('CREDIT_DUE'), 'Credit / Refund Due');

console.log('stay mapper financial state assertions passed');
