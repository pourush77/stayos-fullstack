export enum PropertyPolicyType {
  INDIVIDUAL_DEPOSIT = 'INDIVIDUAL_DEPOSIT',
  GROUP_DEPOSIT = 'GROUP_DEPOSIT',
  CANCELLATION = 'CANCELLATION',
  NO_SHOW = 'NO_SHOW',
  EARLY_CHECK_IN = 'EARLY_CHECK_IN',
  LATE_CHECKOUT = 'LATE_CHECKOUT',
}

export const DEPOSIT_POLICY_TYPES: ReadonlyArray<PropertyPolicyType> = [
  PropertyPolicyType.INDIVIDUAL_DEPOSIT,
  PropertyPolicyType.GROUP_DEPOSIT,
];

export const CHARGE_POLICY_TYPES: ReadonlyArray<PropertyPolicyType> = [
  PropertyPolicyType.CANCELLATION,
  PropertyPolicyType.NO_SHOW,
  PropertyPolicyType.EARLY_CHECK_IN,
  PropertyPolicyType.LATE_CHECKOUT,
];
