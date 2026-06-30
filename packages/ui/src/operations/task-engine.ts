export type OperationalDepartment =
  | 'Front Desk'
  | 'Housekeeping'
  | 'Maintenance'
  | 'Laundry'
  | 'Billing'
  | 'Concierge'
  | 'Rooms';

export type OperationalPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export type OperationalTaskStatus = 'Pending' | 'In Progress' | 'Completed';

export type OperationalTask = {
  id: string;
  title: string;
  description: string;
  department: OperationalDepartment;
  priority: OperationalPriority;
  status: OperationalTaskStatus;
  timestamp: string;
  primaryAction: string;
  source: string;
  relatedGuest?: string;
  relatedReservation?: string;
  relatedRoom?: string;
  href?: string;
};

export const operationalTasks: OperationalTask[] = [
  {
    id: 'task-room-402-clean',
    title: 'Room 402 cleaning complete',
    description: 'Housekeeping marked Suite 402 ready after priority cleaning.',
    department: 'Front Desk',
    priority: 'High',
    status: 'Pending',
    timestamp: '09:42',
    primaryAction: 'Open Stay',
    source: 'Room cleaned',
    relatedGuest: 'Ananya Rao',
    relatedReservation: 'ST1842',
    relatedRoom: '402',
    href: '/guest-stay/ST1842',
  },
  {
    id: 'task-payment-st1845',
    title: 'Payment due before checkout',
    description: 'Invoice ST1845 has INR 12,500 outstanding.',
    department: 'Billing',
    priority: 'Urgent',
    status: 'Pending',
    timestamp: '09:58',
    primaryAction: 'Receive Payment',
    source: 'Payment pending',
    relatedReservation: 'ST1845',
    relatedRoom: '118',
  },
  {
    id: 'task-vip-arrival-kapoor',
    title: 'VIP arrival needs attention',
    description: 'Mr Kapoor arrives at 11:30. Airport pickup is confirmed.',
    department: 'Front Desk',
    priority: 'High',
    status: 'In Progress',
    timestamp: '10:05',
    primaryAction: 'Open Booking',
    source: 'VIP arrival',
    relatedGuest: 'Mr Kapoor',
    relatedReservation: 'ST1851',
    relatedRoom: '501',
  },
  {
    id: 'task-laundry-402',
    title: 'Laundry waiting for delivery',
    description: 'Express laundry for Ananya Rao is still pending delivery.',
    department: 'Laundry',
    priority: 'High',
    status: 'Pending',
    timestamp: '10:18',
    primaryAction: 'View Request',
    source: 'Guest request created',
    relatedGuest: 'Ananya Rao',
    relatedReservation: 'ST1842',
    relatedRoom: '402',
    href: '/guest-stay/ST1842',
  },
  {
    id: 'task-maintenance-305',
    title: 'AC repair started',
    description: 'Maintenance is working on Room 305. Guest reported AC not cooling.',
    department: 'Maintenance',
    priority: 'Urgent',
    status: 'In Progress',
    timestamp: '10:22',
    primaryAction: 'View Room',
    source: 'Maintenance started',
    relatedRoom: '305',
    href: '/rooms/305',
  },
  {
    id: 'task-checkout-402',
    title: 'Checkout completed',
    description: 'Room 402 was released and housekeeping was notified.',
    department: 'Housekeeping',
    priority: 'Normal',
    status: 'Pending',
    timestamp: '10:35',
    primaryAction: 'Start Cleaning',
    source: 'Checkout completed',
    relatedGuest: 'Ananya Rao',
    relatedReservation: 'ST1842',
    relatedRoom: '402',
    href: '/housekeeping/402',
  },
  {
    id: 'task-room-302-waiting',
    title: 'Guest waiting for room',
    description: 'Room 302 is still being cleaned while guest waits at reception.',
    department: 'Rooms',
    priority: 'Urgent',
    status: 'Pending',
    timestamp: '10:41',
    primaryAction: 'Assign Room',
    source: 'Waiting guest',
    relatedGuest: 'Jaipur Textiles Group',
    relatedReservation: 'ST1849',
    relatedRoom: '302',
    href: '/rooms/302',
  },
];

const priorityOrder: Record<OperationalPriority, number> = {
  Urgent: 4,
  High: 3,
  Normal: 2,
  Low: 1,
};

export function getOpenOperationalTasks(options?: {
  department?: OperationalDepartment;
  room?: string;
  guest?: string;
  reservation?: string;
  limit?: number;
}) {
  const tasks = operationalTasks
    .filter((task) => task.status !== 'Completed')
    .filter((task) => (options?.department ? task.department === options.department : true))
    .filter((task) => (options?.room ? task.relatedRoom === options.room : true))
    .filter((task) => (options?.guest ? task.relatedGuest === options.guest : true))
    .filter((task) =>
      options?.reservation ? task.relatedReservation === options.reservation : true,
    )
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

  return typeof options?.limit === 'number' ? tasks.slice(0, options.limit) : tasks;
}

export function getTasksForPath(pathname: string) {
  if (pathname.startsWith('/reservations')) {
    return getOpenOperationalTasks({ limit: 4 });
  }

  if (pathname.startsWith('/rooms')) {
    return getOpenOperationalTasks({ department: 'Rooms', limit: 4 });
  }

  if (pathname.startsWith('/housekeeping')) {
    return getOpenOperationalTasks({ department: 'Housekeeping', limit: 4 });
  }

  if (pathname.startsWith('/requests')) {
    return getOpenOperationalTasks({ limit: 4 });
  }

  if (pathname.startsWith('/guest-stay')) {
    return getOpenOperationalTasks({ reservation: 'ST1842', limit: 4 });
  }

  if (pathname.startsWith('/guests')) {
    return getOpenOperationalTasks({ guest: 'Ananya Rao', limit: 4 });
  }

  return getOpenOperationalTasks({ limit: 4 });
}
