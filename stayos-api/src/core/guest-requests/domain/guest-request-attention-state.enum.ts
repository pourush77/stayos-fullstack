export enum GuestRequestAttentionState {
  UPCOMING = 'UPCOMING',
  DUE_SOON = 'DUE_SOON',
  UNACKNOWLEDGED = 'UNACKNOWLEDGED',
  OVERDUE = 'OVERDUE',
  SLA_BREACHED = 'SLA_BREACHED',
  ESCALATED = 'ESCALATED',
}

export enum GuestRequestAttentionSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}
