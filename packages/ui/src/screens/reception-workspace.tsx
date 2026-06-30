'use client';

import {
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  DoorOpen,
  Hotel,
  KeyRound,
  Luggage,
  Moon,
  Plus,
  Sparkles,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { animations, colors, radius, shadows, spacing, typography } from '@stayos/theme';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import { Card } from '../components/card';
import { getStatusTokens } from '../components/visual-language';
import type { StayOSStatusTone } from '../components/visual-language';

type OperationMetric = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: StayOSStatusTone;
};

type QueueItem = {
  time: string;
  guest: string;
  reservation?: string;
  room: string;
  operation: string;
  support: string;
  status: string;
};

type RoomStatus = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
};

type AlertItem = {
  title: string;
  detail: string;
  level: 'High' | 'Medium';
};

const propertyName = 'Hillston Resort & Club';
const receptionistName = 'Aarav';

const todayOperations: OperationMetric[] = [
  { label: 'Arrivals', value: '12', detail: '6 ready now', icon: <Luggage size={16} />, tone: 'success' },
  { label: 'Departures', value: '11', detail: '4 pending', icon: <DoorOpen size={16} />, tone: 'attention' },
  { label: 'Occupancy', value: '78%', detail: '42 of 54 rooms', icon: <Hotel size={16} />, tone: 'muted' },
  { label: 'Rooms Cleaning', value: '9', detail: '3 priority', icon: <Sparkles size={16} />, tone: 'progress' },
  { label: 'Pending Payments', value: '5', detail: 'INR 38,400', icon: <CreditCard size={16} />, tone: 'danger' },
  { label: 'VIP Arrivals', value: '2', detail: 'Before 3 PM', icon: <Users size={16} />, tone: 'premium' },
];

const receptionQueue: QueueItem[] = [
  {
    time: '09:15',
    guest: 'Ananya Rao',
    reservation: 'ST-1842',
    room: 'Room 402',
    operation: 'Early check-in',
    support: 'Room marked priority clean.',
    status: 'Priority Clean',
  },
  {
    time: '10:00',
    guest: 'Jaipur Textiles Group',
    reservation: 'Group',
    room: '5 Rooms',
    operation: 'Checkout',
    support: 'Collect balance before releasing invoices.',
    status: 'Payment Pending',
  },
  {
    time: '11:30',
    guest: 'Mr Kapoor',
    reservation: 'VIP',
    room: 'Suite 501',
    operation: 'VIP Arrival',
    support: 'Airport pickup confirmation needed.',
    status: 'Airport Pickup',
  },
  {
    time: '13:00',
    guest: 'Room 214',
    room: 'Maintenance',
    operation: 'Maintenance Review',
    support: 'AC service needs front desk confirmation.',
    status: 'Do Not Assign',
  },
  {
    time: '15:00',
    guest: 'Arrivals Window',
    room: '12 Guests',
    operation: 'Standard Check-in',
    support: 'Prepare room keys and ID verification.',
    status: 'Prepare Keys',
  },
];

const roomStatuses: RoomStatus[] = [
  { label: 'Available', value: '12', detail: 'Ready to sell', icon: <CheckCircle2 size={18} /> },
  { label: 'Occupied', value: '42', detail: 'Currently in house', icon: <Moon size={18} /> },
  { label: 'Cleaning', value: '9', detail: 'Housekeeping active', icon: <Sparkles size={18} /> },
  { label: 'Maintenance', value: '2', detail: 'Requires attention', icon: <Wrench size={18} /> },
  { label: 'Reserved', value: '18', detail: 'Arriving today', icon: <CalendarCheck size={18} /> },
];

const quickActions: { label: string; icon: ReactNode }[] = [
  { label: 'New Reservation', icon: <Plus size={16} /> },
  { label: 'Walk-in Guest', icon: <UserPlus size={16} /> },
  { label: 'Check-in', icon: <KeyRound size={16} /> },
  { label: 'Check-out', icon: <DoorOpen size={16} /> },
  { label: 'Assign Room', icon: <BedDouble size={16} /> },
  { label: 'Block Room', icon: <Wrench size={16} /> },
];

const alerts: AlertItem[] = [
  {
    title: 'Room 402 needs priority cleaning',
    detail: 'VIP arrival expected at 12:30 PM.',
    level: 'High',
  },
  {
    title: 'Payment pending before checkout',
    detail: 'Room 118 has INR 12,800 balance.',
    level: 'High',
  },
  {
    title: 'ID verification incomplete',
    detail: '2 arrivals still missing guest documents.',
    level: 'Medium',
  },
];

const recentActivity = [
  'Neha assigned Room 305 to booking ST-1829',
  'Arjun marked Room 214 under maintenance',
  'Priya collected advance payment for ST-1837',
  'Housekeeping completed Room 109',
];

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: spacing[3],
  marginBottom: spacing[4],
};

const interactiveStyle: CSSProperties = {
  cursor: 'pointer',
  transition: `transform ${animations.duration.fast} ${animations.easing.standard}, box-shadow ${animations.duration.fast} ${animations.easing.standard}, background ${animations.duration.fast} ${animations.easing.standard}`,
};

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div style={sectionHeaderStyle}>
      <div>
        <h2 style={{ ...typography.styles.h3, color: colors.text.strong, margin: 0 }}>{title}</h2>
        {note ? (
          <p
            style={{
              ...typography.styles.small,
              color: colors.text.muted,
              margin: `${spacing[1]} 0 0`,
            }}
          >
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function WelcomeHeader() {
  const currentDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <Card
      p={spacing[6]}
      style={{
        border: 'none',
        boxShadow: shadows.xs,
        minHeight: 260,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <img
        alt=""
        aria-hidden="true"
        src="/images/reception-hero.png"
        style={{
          height: '100%',
          inset: 0,
          objectFit: 'cover',
          objectPosition: 'center right',
          position: 'absolute',
          width: '100%',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          background: `linear-gradient(90deg, ${colors.surface.base} 0%, ${colors.surface.base} 34%, rgba(255, 255, 255, 0.72) 54%, rgba(255, 255, 255, 0) 72%)`,
          inset: 0,
          position: 'absolute',
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: spacing[8],
          alignItems: 'center',
          minHeight: 212,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div>
          <div style={{ alignItems: 'center', display: 'flex', gap: spacing[2] }}>
            <p style={{ ...typography.styles.h2, color: colors.text.strong, margin: 0 }}>
              Good morning, {receptionistName}
            </p>
            <img
              alt=""
              aria-hidden="true"
              src="/images/handwave.png"
              style={{ height: 30, width: 30 }}
            />
          </div>
          <h1
            style={{
              ...typography.styles.h3,
              color: colors.text.strong,
              margin: `${spacing[2]} 0 ${spacing[3]}`,
            }}
          >
            Everything is under control.
          </h1>
          <p style={{ ...typography.styles.body, color: colors.text.body, margin: 0 }}>
            {currentDate} · {propertyName}
          </p>
          <p
            style={{
              ...typography.styles.small,
              color: colors.text.muted,
              margin: `${spacing[2]} 0 0`,
            }}
          >
            Morning Shift · 07:00 AM - 03:00 PM
          </p>
          <p
            style={{
              ...typography.styles.label,
              color: colors.text.strong,
              margin: `${spacing[4]} 0 0`,
            }}
          >
            12 Arrivals · 11 Departures
          </p>
        </div>
      </div>
    </Card>
  );
}

function OperationsStrip() {
  return (
    <Card p={0} style={{ overflow: 'hidden', border: 'none', boxShadow: shadows.xs }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          background: colors.surface.base,
        }}
      >
        {todayOperations.map((metric, index) => {
          const tokens = getStatusTokens(metric.tone);

          return (
            <div
              key={metric.label}
              role="button"
              tabIndex={0}
              style={{
                ...interactiveStyle,
                minHeight: 140,
                padding: spacing[6],
                background: tokens.background,
                borderInlineStart: index === 0 ? 'none' : `1px solid ${colors.border.subtle}`,
                borderTop: `4px solid ${tokens.color}`,
              }}
            >
            <div
              style={{
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                borderRadius: radius.md,
                color: tokens.color,
                background: colors.surface.base,
                marginBottom: spacing[4],
              }}
            >
              {metric.icon}
            </div>
            <p style={{ ...typography.styles.h1, color: tokens.color, margin: 0 }}>
              {metric.value}
            </p>
            <p
              style={{
                ...typography.styles.label,
                color: colors.text.body,
                margin: `${spacing[2]} 0 0`,
              }}
            >
              {metric.label}
            </p>
            <p
              style={{
                ...typography.styles.caption,
                color: colors.text.muted,
                margin: `${spacing[1]} 0 0`,
              }}
            >
              {metric.detail}
            </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ReceptionQueueCard() {
  return (
    <Card p={spacing[5]} style={{ boxShadow: shadows.xs }}>
      <SectionTitle title="Reception Queue" note="Who needs front desk attention next" />
      <div style={{ display: 'grid', gap: spacing[4] }}>
        {receptionQueue.map((item) => (
          <div
            key={`${item.time}-${item.guest}`}
            role="button"
            tabIndex={0}
            style={{
              ...interactiveStyle,
              display: 'grid',
              gridTemplateColumns: '56px 14px minmax(0, 1fr)',
              gap: spacing[3],
              alignItems: 'start',
              paddingBlock: spacing[3],
            }}
          >
            <p style={{ ...typography.styles.label, color: colors.brand[500], margin: 0 }}>
              {item.time}
            </p>
            <span
              aria-hidden="true"
              style={{
                width: 9,
                height: 9,
                borderRadius: radius.full,
                background: colors.brand[500],
                marginTop: 6,
              }}
            />
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing[3] }}>
                <div>
                  <p style={{ ...typography.styles.h3, color: colors.text.strong, margin: 0 }}>
                    {item.guest}
                  </p>
                  <p
                    style={{
                      ...typography.styles.small,
                      color: colors.text.body,
                      margin: `${spacing[1]} 0 0`,
                    }}
                  >
                    {item.operation} · {item.support}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      gap: spacing[2],
                      marginTop: spacing[2],
                      flexWrap: 'wrap',
                    }}
                  >
                    {item.reservation ? (
                      <Badge color="gray" size="sm" variant="light">
                        {item.reservation}
                      </Badge>
                    ) : null}
                    <Badge color="stayosBrand" size="sm" variant="light">
                      {item.room}
                    </Badge>
                  </div>
                </div>
                <Badge color="stayosBrand" size="sm" variant="light">
                  {item.status}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RoomStatusCard() {
  return (
    <Card p={spacing[5]} style={{ boxShadow: shadows.xs }}>
      <SectionTitle title="Room Status" note="Sell, assign, or hold rooms with confidence" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
          gap: spacing[3],
        }}
      >
        {roomStatuses.map((room) => (
          <div
            key={room.label}
            role="button"
            tabIndex={0}
            style={{
              ...interactiveStyle,
              minHeight: 146,
              padding: spacing[4],
              borderRadius: radius.lg,
              background: colors.surface.subtle,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: spacing[4],
                right: spacing[4],
                color: colors.brand[500],
                opacity: 0.18,
              }}
            >
              {room.icon}
            </div>
            <p style={{ ...typography.styles.label, color: colors.text.body, margin: 0 }}>
              {room.label}
            </p>
            <p
              style={{
                ...typography.styles.display,
                color: colors.text.strong,
                margin: `${spacing[2]} 0 ${spacing[1]}`,
              }}
            >
              {room.value}
            </p>
            <p style={{ ...typography.styles.caption, color: colors.text.muted, margin: 0 }}>
              {room.detail}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function QuickActionsCard() {
  return (
    <Card p={spacing[5]} style={{ boxShadow: shadows.xs }}>
      <SectionTitle title="Quick Actions" note="Shortcuts for the front desk" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: spacing[3],
        }}
      >
        {quickActions.map((action) => (
          <Button
            key={action.label}
            leftSection={action.icon}
            variant="light"
            color="stayosBrand"
            justify="flex-start"
            size="md"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function AlertsCard() {
  return (
    <Card p={spacing[5]} style={{ boxShadow: shadows.xs }}>
      <SectionTitle title="Alerts" note="Resolve these before the shift gets busy" />
      <div style={{ display: 'grid', gap: spacing[3] }}>
        {alerts.map((alert) => (
          <div
            key={alert.title}
            role="button"
            tabIndex={0}
            style={{
              ...interactiveStyle,
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: spacing[3],
              alignItems: 'start',
              padding: spacing[4],
              borderRadius: radius.md,
              background: colors.surface.subtle,
            }}
          >
            <div>
              <p style={{ ...typography.styles.label, color: colors.text.strong, margin: 0 }}>
                {alert.title}
              </p>
              <p
                style={{
                  ...typography.styles.small,
                  color: colors.text.body,
                  margin: `${spacing[1]} 0 0`,
                }}
              >
                {alert.detail}
              </p>
            </div>
            <Badge
              variant="outline"
              style={{
                color: alert.level === 'High' ? colors.semantic.danger : colors.semantic.warning,
                borderColor:
                  alert.level === 'High' ? colors.semantic.danger : colors.semantic.warning,
              }}
              size="sm"
            >
              {alert.level}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecentActivityCard() {
  return (
    <Card p={spacing[5]} style={{ boxShadow: shadows.xs }}>
      <SectionTitle title="Recent Activity" note="Continuity across the front office team" />
      <div style={{ display: 'grid', gap: spacing[3] }}>
        {recentActivity.map((activity) => (
          <div
            key={activity}
            style={{
              display: 'grid',
              gridTemplateColumns: '12px 1fr',
              gap: spacing[3],
              alignItems: 'center',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: radius.full,
                background: colors.brand[500],
              }}
            />
            <p style={{ ...typography.styles.small, color: colors.text.body, margin: 0 }}>
              {activity}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FloatingQuickActions() {
  return (
    <Card
      p={spacing[3]}
      style={{
        position: 'fixed',
        right: spacing[6],
        bottom: spacing[6],
        zIndex: 120,
        boxShadow: shadows.md,
        borderRadius: radius.lg,
        transition: `transform ${animations.duration.base} ${animations.easing.entrance}, box-shadow ${animations.duration.base} ${animations.easing.entrance}`,
      }}
    >
      <div style={{ display: 'grid', gap: spacing[2] }}>
        <Button leftSection={<Plus size={16} />} color="stayosBrand">
          Reception shortcut
        </Button>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(132px, 1fr))',
            gap: spacing[2],
          }}
        >
          {quickActions.slice(1).map((action) => (
            <Button
              key={action.label}
              leftSection={action.icon}
              variant="subtle"
              color="stayosBrand"
              size="xs"
              justify="flex-start"
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function ReceptionWorkspace() {
  return (
    <div style={{ display: 'grid', gap: spacing[6] }}>
      <WelcomeHeader />
      <OperationsStrip />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap: spacing[5],
        }}
      >
        <ReceptionQueueCard />
        <RoomStatusCard />
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: spacing[5],
        }}
      >
        <QuickActionsCard />
        <AlertsCard />
      </section>

      <RecentActivityCard />
      <FloatingQuickActions />
    </div>
  );
}
