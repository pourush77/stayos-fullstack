import { GuestRequestDepartment } from './domain/guest-request-department.enum';
import {
  GuestRequestAttentionSeverity,
  GuestRequestAttentionState,
} from './domain/guest-request-attention-state.enum';
import { GuestRequestStatus } from './domain/guest-request-status.enum';
import { GuestRequestType } from './domain/guest-request-type.enum';
import { GuestRequestEntity } from './infrastructure/guest-request.entity';

export type GuestRequestTimingPolicy = {
  acknowledgeWithinMinutes?: number;
  completeWithinMinutes?: number;
  reminderMinutesBefore?: number[];
  escalateAfterDueMinutes?: number;
  escalateUnacknowledgedAfterMinutes?: number;
};

export type GuestRequestAttentionEvaluation = {
  state: GuestRequestAttentionState;
  severity: GuestRequestAttentionSeverity;
  message: string;
  minutesUntilDue: number | null;
  minutesOverdue: number | null;
};

const servicePolicies: Partial<Record<GuestRequestType, GuestRequestTimingPolicy>> = {
  [GuestRequestType.WAKE_UP_CALL]: {
    acknowledgeWithinMinutes: 5,
    reminderMinutesBefore: [10, 5],
    escalateAfterDueMinutes: 5,
    escalateUnacknowledgedAfterMinutes: 10,
  },

  [GuestRequestType.EXTRA_TOWELS]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 15,
    reminderMinutesBefore: [5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 10,
  },
  [GuestRequestType.EXTRA_PILLOW]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 15,
    reminderMinutesBefore: [5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 10,
  },
  [GuestRequestType.WATER_BOTTLES]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 10,
    reminderMinutesBefore: [5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 10,
  },
  [GuestRequestType.BABY_COT]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 20,
    reminderMinutesBefore: [5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 10,
  },
  [GuestRequestType.EXTRA_BED]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 20,
    reminderMinutesBefore: [5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 10,
  },
  [GuestRequestType.HAIR_DRYER]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 15,
    reminderMinutesBefore: [5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 10,
  },
  [GuestRequestType.IRON_BOARD]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 15,
    reminderMinutesBefore: [5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 10,
  },
  [GuestRequestType.ROOM_CLEANING]: {
    acknowledgeWithinMinutes: 10,
    completeWithinMinutes: 30,
    reminderMinutesBefore: [10, 5],
    escalateAfterDueMinutes: 15,
    escalateUnacknowledgedAfterMinutes: 20,
  },

  [GuestRequestType.LAUNDRY_PICKUP]: {
    acknowledgeWithinMinutes: 10,
    completeWithinMinutes: 60,
    reminderMinutesBefore: [15, 5],
    escalateAfterDueMinutes: 15,
    escalateUnacknowledgedAfterMinutes: 20,
  },

  [GuestRequestType.LUGGAGE_ASSISTANCE]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 15,
    reminderMinutesBefore: [10, 5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 10,
  },

  [GuestRequestType.AC_ISSUE]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 30,
    reminderMinutesBefore: [10, 5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 15,
  },
  [GuestRequestType.TV_ISSUE]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 30,
    reminderMinutesBefore: [10, 5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 15,
  },
  [GuestRequestType.WIFI_ISSUE]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 20,
    reminderMinutesBefore: [10, 5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 15,
  },

  [GuestRequestType.SPECIAL_DECORATION]: {
    acknowledgeWithinMinutes: 15,
    completeWithinMinutes: 120,
    reminderMinutesBefore: [30, 10],
    escalateAfterDueMinutes: 15,
    escalateUnacknowledgedAfterMinutes: 30,
  },
  [GuestRequestType.FLOWERS]: {
    acknowledgeWithinMinutes: 15,
    completeWithinMinutes: 60,
    reminderMinutesBefore: [30, 10],
    escalateAfterDueMinutes: 15,
    escalateUnacknowledgedAfterMinutes: 30,
  },
  [GuestRequestType.CAKE]: {
    acknowledgeWithinMinutes: 15,
    completeWithinMinutes: 60,
    reminderMinutesBefore: [30, 10],
    escalateAfterDueMinutes: 15,
    escalateUnacknowledgedAfterMinutes: 30,
  },

  [GuestRequestType.OTHER]: {
    acknowledgeWithinMinutes: 10,
    completeWithinMinutes: 30,
    reminderMinutesBefore: [10, 5],
    escalateAfterDueMinutes: 15,
    escalateUnacknowledgedAfterMinutes: 20,
  },

  // Transport is currently disabled in the StayOS UI, but keeping a policy here
  // means backend behavior stays deterministic if an older client sends one.
  [GuestRequestType.TAXI]: {
    acknowledgeWithinMinutes: 10,
    completeWithinMinutes: 45,
    reminderMinutesBefore: [15, 5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 20,
  },
  [GuestRequestType.AIRPORT_PICKUP]: {
    acknowledgeWithinMinutes: 10,
    completeWithinMinutes: 45,
    reminderMinutesBefore: [30, 10, 5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 20,
  },
  [GuestRequestType.AIRPORT_DROP]: {
    acknowledgeWithinMinutes: 10,
    completeWithinMinutes: 45,
    reminderMinutesBefore: [30, 10, 5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 20,
  },
};

const departmentFallbackPolicies: Record<GuestRequestDepartment, GuestRequestTimingPolicy> = {
  [GuestRequestDepartment.HOUSEKEEPING]: {
    acknowledgeWithinMinutes: 10,
    completeWithinMinutes: 20,
    reminderMinutesBefore: [5],
    escalateAfterDueMinutes: 15,
    escalateUnacknowledgedAfterMinutes: 20,
  },
  [GuestRequestDepartment.MAINTENANCE]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 30,
    reminderMinutesBefore: [10, 5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 15,
  },
  [GuestRequestDepartment.LAUNDRY]: {
    acknowledgeWithinMinutes: 10,
    completeWithinMinutes: 60,
    reminderMinutesBefore: [15, 5],
    escalateAfterDueMinutes: 15,
    escalateUnacknowledgedAfterMinutes: 20,
  },
  [GuestRequestDepartment.RECEPTION]: {
    acknowledgeWithinMinutes: 5,
    completeWithinMinutes: 20,
    reminderMinutesBefore: [10, 5],
    escalateAfterDueMinutes: 10,
    escalateUnacknowledgedAfterMinutes: 15,
  },
  [GuestRequestDepartment.CONCIERGE]: {
    acknowledgeWithinMinutes: 10,
    completeWithinMinutes: 45,
    reminderMinutesBefore: [15, 5],
    escalateAfterDueMinutes: 15,
    escalateUnacknowledgedAfterMinutes: 20,
  },
  [GuestRequestDepartment.F_AND_B]: {
    acknowledgeWithinMinutes: 10,
    completeWithinMinutes: 30,
    reminderMinutesBefore: [15, 5],
    escalateAfterDueMinutes: 15,
    escalateUnacknowledgedAfterMinutes: 20,
  },
};

export function getGuestRequestTimingPolicy(
  requestType: GuestRequestType | null | undefined,
  department: GuestRequestDepartment,
): GuestRequestTimingPolicy {
  if (requestType && servicePolicies[requestType]) {
    return servicePolicies[requestType] as GuestRequestTimingPolicy;
  }

  return departmentFallbackPolicies[department];
}

export function defaultGuestRequestDueAt(
  requestType: GuestRequestType | null | undefined,
  department: GuestRequestDepartment,
  now = new Date(),
): Date {
  const policy = getGuestRequestTimingPolicy(requestType, department);
  const minutes = policy.completeWithinMinutes ?? 20;
  return new Date(now.getTime() + minutes * 60_000);
}

function minutesBetween(later: Date, earlier: Date) {
  return Math.floor((later.getTime() - earlier.getTime()) / 60_000);
}

function dueMessage(request: GuestRequestEntity, minutes: number) {
  if (request.requestType === GuestRequestType.WAKE_UP_CALL) {
    return `Wake-up call for ${request.room?.roomNumber ? `Room ${request.room.roomNumber}` : 'guest'} is due in ${minutes} min.`;
  }

  return `${request.title} is due in ${minutes} min.`;
}

export function evaluateGuestRequestAttention(
  request: GuestRequestEntity,
  now = new Date(),
): GuestRequestAttentionEvaluation | null {
  if ([GuestRequestStatus.COMPLETED, GuestRequestStatus.CANCELLED].includes(request.status)) {
    return null;
  }

  const policy = getGuestRequestTimingPolicy(request.requestType, request.department);
  const ageMinutes = Math.max(0, minutesBetween(now, request.createdAt));

  if (
    request.status === GuestRequestStatus.REQUESTED &&
    policy.escalateUnacknowledgedAfterMinutes !== undefined &&
    ageMinutes >= policy.escalateUnacknowledgedAfterMinutes
  ) {
    return {
      state: GuestRequestAttentionState.ESCALATED,
      severity: GuestRequestAttentionSeverity.CRITICAL,
      message: `${request.title} has not been acknowledged for ${ageMinutes} min.`,
      minutesUntilDue: request.dueAt ? Math.max(0, minutesBetween(request.dueAt, now)) : null,
      minutesOverdue:
        request.dueAt && request.dueAt < now
          ? Math.max(1, minutesBetween(now, request.dueAt))
          : null,
    };
  }

  if (request.dueAt && request.dueAt <= now) {
    const overdueMinutes = Math.max(1, minutesBetween(now, request.dueAt));

    if (
      policy.escalateAfterDueMinutes !== undefined &&
      overdueMinutes >= policy.escalateAfterDueMinutes
    ) {
      return {
        state: GuestRequestAttentionState.ESCALATED,
        severity: GuestRequestAttentionSeverity.CRITICAL,
        message: `${request.title} is ${overdueMinutes} min overdue and needs escalation.`,
        minutesUntilDue: 0,
        minutesOverdue: overdueMinutes,
      };
    }

    return {
      state: GuestRequestAttentionState.OVERDUE,
      severity: GuestRequestAttentionSeverity.CRITICAL,
      message: `${request.title} is ${overdueMinutes} min overdue.`,
      minutesUntilDue: 0,
      minutesOverdue: overdueMinutes,
    };
  }

  if (
    request.status === GuestRequestStatus.REQUESTED &&
    policy.acknowledgeWithinMinutes !== undefined &&
    ageMinutes >= policy.acknowledgeWithinMinutes
  ) {
    return {
      state: GuestRequestAttentionState.UNACKNOWLEDGED,
      severity: GuestRequestAttentionSeverity.WARNING,
      message: `${request.title} has been waiting ${ageMinutes} min for acknowledgement.`,
      minutesUntilDue: request.dueAt ? Math.max(0, minutesBetween(request.dueAt, now)) : null,
      minutesOverdue: null,
    };
  }

  if (
    !request.dueAt &&
    policy.completeWithinMinutes !== undefined &&
    ageMinutes >= policy.completeWithinMinutes
  ) {
    return {
      state: GuestRequestAttentionState.SLA_BREACHED,
      severity: GuestRequestAttentionSeverity.CRITICAL,
      message: `${request.title} has exceeded its ${policy.completeWithinMinutes} min service SLA.`,
      minutesUntilDue: null,
      minutesOverdue: ageMinutes - policy.completeWithinMinutes,
    };
  }

  if (request.dueAt && policy.reminderMinutesBefore?.length) {
    const minutesUntilDue = Math.max(0, minutesBetween(request.dueAt, now));
    const thresholds = [...policy.reminderMinutesBefore].sort((a, b) => b - a);
    const largest = thresholds[0];
    const smallest = thresholds[thresholds.length - 1];

    if (minutesUntilDue <= smallest) {
      return {
        state: GuestRequestAttentionState.DUE_SOON,
        severity: GuestRequestAttentionSeverity.WARNING,
        message: dueMessage(request, minutesUntilDue),
        minutesUntilDue,
        minutesOverdue: null,
      };
    }

    if (minutesUntilDue <= largest) {
      return {
        state: GuestRequestAttentionState.UPCOMING,
        severity: GuestRequestAttentionSeverity.INFO,
        message: dueMessage(request, minutesUntilDue),
        minutesUntilDue,
        minutesOverdue: null,
      };
    }
  }

  return null;
}
