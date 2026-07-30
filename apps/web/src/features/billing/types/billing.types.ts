export type FolioStatus = 'OPEN' | 'SETTLED' | 'VOID';

export type FolioChargeType =
  | 'ROOM'
  | 'FOOD_AND_BEVERAGE'
  | 'MINIBAR'
  | 'LAUNDRY'
  | 'SPA'
  | 'TAX'
  | 'DISCOUNT'
  | 'MISC';

export type FolioPaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'WALLET'
  | 'OTHER';

export type FolioCharge = {
  id: string;
  folioId: string;
  type: FolioChargeType;
  description: string;
  quantity: number;
  unitAmount: string;
  amount: string;
  taxAmount: string;
  chargedAt: string;
  createdByUserId: string | null;
  createdAt: string;
};

export type FolioPayment = {
  id: string;
  folioId: string;
  method: FolioPaymentMethod;
  amount: string;
  reference: string | null;
  notes: string | null;
  receivedAt: string;
  receivedByUserId: string | null;
  createdAt: string;
};

export type FolioTotals = {
  subtotal: string;
  tax: string;
  total: string;
  paid: string;
  balance: string;
};

export type FolioGuestSummary = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  isVip: boolean;
};

export type FolioReservationSummary = {
  id: string;
  reservationCode: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  paymentStatus: string;
  roomId: string | null;
};

export type Folio = {
  id: string;
  propertyId: string;
  reservationId: string;
  guestId: string;
  folioNumber: string;
  status: FolioStatus;
  currency: string;
  settledAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totals: FolioTotals;
  guest: FolioGuestSummary;
  reservation: FolioReservationSummary;
  charges: FolioCharge[];
  payments: FolioPayment[];
};

export type BillingOverview = {
  openFolios: number;
  settledFolios: number;
  voidFolios: number;
  outstandingBalance: string;
  todayRevenue: string;
  monthRevenue: string;
};

export type CreateChargePayload = {
  type: FolioChargeType;
  description: string;
  quantity?: number;
  unitAmount: string;
  taxAmount?: string;
  chargedAt?: string;
};

export type CreatePaymentPayload = {
  method: FolioPaymentMethod;
  amount: string;
  reference?: string;
  notes?: string;
  receivedAt?: string;
};
