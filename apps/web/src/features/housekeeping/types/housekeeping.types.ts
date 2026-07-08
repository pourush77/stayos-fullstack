import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';

export type HousekeepingEmployee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  department: string;
  designation: string;
  phone?: string;
  status: string;
  propertyName?: string;
  staffAccessEnabled?: boolean;
  staffAccessToken?: string;
};

export type HousekeepingChecklistKey =
  | 'BED'
  | 'BATHROOM'
  | 'TOWELS'
  | 'TOILETRIES'
  | 'MIRROR'
  | 'FLOOR'
  | 'DUSTBIN';

export type HousekeepingChecklistItem = {
  key: HousekeepingChecklistKey;
  label: string;
  icon: ComponentType<LucideProps>;
  completed: boolean;
};

export type HousekeepingStatus =
  | 'dirty'
  | 'cleaning'
  | 'inspection'
  | 'ready'
  | 'maintenance'
  | 'out-of-order'
  | 'out-of-service';

export type HousekeepingRoom = {
  id: string;
  number: string;
  roomType: string;
  floor: string;
  status: HousekeepingStatus;
  updatedAt?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  startedAt?: string;
  completedAt?: string;
  inspectedAt?: string;
  completedOnBehalf?: boolean;
  completedByEmployeeId?: string;
  completedByUserId?: string;
  inspectedByUserId?: string;
  checklist: HousekeepingChecklistItem[];
  reworkReason?: string;
};

export type HousekeepingInspectAction = 'APPROVE' | 'REJECT';
