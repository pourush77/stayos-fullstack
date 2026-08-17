export enum ReservationSource {
  // Canonical vocabulary (preferred for all NEW writes).
  FRONT_DESK = 'FRONT_DESK',
  WALK_IN = 'WALK_IN',
  PHONE = 'PHONE',
  WEBSITE = 'WEBSITE',
  CORPORATE = 'CORPORATE',
  CHANNEL = 'CHANNEL',
  OTHER = 'OTHER',

  // Legacy values retained for backward-compatible READS only. Historical rows
  // keep these; new writes should use the canonical vocabulary above. NOT
  // backfilled (true origin is ambiguous — e.g. DIRECT is not necessarily
  // FRONT_DESK, OTA is not necessarily CHANNEL).
  /** @deprecated legacy — prefer FRONT_DESK for new writes */
  DIRECT = 'DIRECT',
  /** @deprecated legacy — prefer CHANNEL for new writes */
  OTA = 'OTA',
}
