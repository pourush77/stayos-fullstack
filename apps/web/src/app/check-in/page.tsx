'use client';

import Link from 'next/link';
import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  BadgeCheck,
  BedDouble,
  Camera,
  Check,
  ChevronLeft,
  CreditCard,
  FileCheck2,
  FileImage,
  KeyRound,
  Laptop,
  MonitorUp,
  QrCode,
  ScanLine,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import { getOpenOperationalTasks, OperationalTaskCard } from '@stayos/ui';
import styles from './check-in.module.css';

type StepKey = 'welcome' | 'identity' | 'photo' | 'room' | 'payment' | 'keys' | 'complete';

type Step = {
  key: StepKey;
  label: string;
  helper: string;
};

type CheckInState = {
  started: boolean;
  identityVerified: boolean;
  photoCaptured: boolean;
  photoNotRequired: boolean;
  roomChosen: boolean;
  paymentReceived: boolean;
  keysIssued: boolean;
};

const steps: Step[] = [
  { key: 'welcome', label: 'Welcome', helper: 'Confirm guest and stay.' },
  { key: 'identity', label: 'Identity', helper: 'Required before keys.' },
  { key: 'photo', label: 'Photo', helper: 'Capture or skip by policy.' },
  { key: 'room', label: 'Room', helper: 'Confirm ready room.' },
  { key: 'payment', label: 'Payment', helper: 'Clear blockers.' },
  { key: 'keys', label: 'Keys', helper: 'Final checklist.' },
  { key: 'complete', label: 'Complete', helper: 'Guest has arrived.' },
];

const guest = {
  name: 'Ananya Rao',
  bookingId: 'ST-1842',
  room: 'Suite 402',
  roomType: 'Premium Suite',
  arrival: '09:15 AM',
  stayDates: '28 Jun - 01 Jul 2026',
  adults: 2,
  children: 1,
  readiness: 92,
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

const documentMethods = [
  { title: 'Scan Mobile', detail: 'Secure guest upload.', icon: QrCode },
  { title: 'Webcam', detail: 'Reception camera.', icon: Camera },
  { title: 'Scanner', detail: 'Connected scanner.', icon: ScanLine },
  { title: 'Upload', detail: 'Image or PDF.', icon: FileImage },
];

const extractedFields = [
  ['ID Type', 'Aadhaar'],
  ['ID Number', 'XXXX-XXXX-4821'],
  ['Name', 'Ananya Rao'],
  ['Date of Birth', '14 May 1991'],
  ['Address', 'Indiranagar, Bengaluru'],
  ['Nationality', 'Indian'],
];

const roomSuggestions = [
  { room: '402', type: 'Premium Suite', status: 'Ready', note: 'High floor, garden view' },
  { room: '407', type: 'Premium Suite', status: 'Cleaning', note: 'Near elevator' },
  { room: '501', type: 'Suite', status: 'Held', note: 'Airport pickup arrival' },
];

const readinessSummary = [
  { label: 'Reservation Ready', complete: true },
  { label: 'Room Ready', complete: true },
  { label: 'Payment Complete', complete: true },
  { label: 'Identity Pending', complete: false },
];

function toneBackground(tone: string) {
  if (tone === colors.semantic.warning) return '#fffbeb';
  if (tone === colors.semantic.info) return '#eff6ff';
  if (tone === colors.semantic.success) return '#f0fdf4';
  if (tone === colors.semantic.danger) return '#fef2f2';
  return '#f5f3ff';
}

function SoftBadge({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <Badge
      radius={radius.full}
      variant="light"
      styles={{
        root: {
          background: toneBackground(tone ?? colors.brand[500]),
          color: tone ?? colors.brand[600],
          fontWeight: 600,
          height: 24,
          paddingInline: 10,
          textTransform: 'none',
        },
      }}
    >
      {children}
    </Badge>
  );
}

function StepHeader({ title, helper, icon }: { title: string; helper: string; icon: ReactNode }) {
  return (
    <Group gap={spacing[3]} align="flex-start" wrap="nowrap">
      <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={42}>
        {icon}
      </ThemeIcon>
      <Box>
        <Title order={1} c={colors.text.strong} style={typography.styles.h2}>
          {title}
        </Title>
        <Text c={colors.text.muted} mt={spacing[1]} style={{ fontSize: 14, fontWeight: 400, lineHeight: '22px' }}>
          {helper}
        </Text>
      </Box>
    </Group>
  );
}

function ProgressSidebar({
  currentStep,
  state,
  onSelect,
}: {
  currentStep: number;
  state: CheckInState;
  onSelect: (index: number) => void;
}) {
  const completeByStep: Record<StepKey, boolean> = {
    welcome: state.started,
    identity: state.identityVerified,
    photo: state.photoCaptured || state.photoNotRequired,
    room: state.roomChosen,
    payment: state.paymentReceived,
    keys: state.keysIssued,
    complete: state.keysIssued,
  };

  return (
    <Card className={styles.stepRail} p={16} radius={radius.lg} style={cardStyle}>
      <Button
        component="a"
        href="/"
        variant="subtle"
        color="gray"
        leftSection={<ChevronLeft size={16} />}
        px={0}
        mb={spacing[3]}
        style={{ fontWeight: 600 }}
      >
        Back to Front Desk
      </Button>
      <Text c="#101828" style={{ fontSize: 14, fontWeight: 700, lineHeight: '20px' }}>
        Check-in Progress
      </Text>
      <Progress
        mt={10}
        value={(Object.values(completeByStep).filter(Boolean).length / steps.length) * 100}
        color="stayosBrand"
        radius={radius.full}
        size={7}
      />
      <Stack mt={spacing[4]} gap={6}>
        {steps.map((step, index) => {
          const isActive = currentStep === index;
          const isComplete = completeByStep[step.key];

          return (
            <UnstyledButton
              key={step.key}
              onClick={() => onSelect(index)}
              style={{
                background: isActive ? '#f5f3ff' : 'transparent',
                border: '1px solid transparent',
                borderRadius: radius.md,
                padding: '9px 10px',
                width: '100%',
              }}
            >
              <Group gap={10} align="center" wrap="nowrap">
                <ThemeIcon
                  color={isComplete || isActive ? 'stayosBrand' : 'gray'}
                  radius={radius.full}
                  size={26}
                  variant={isComplete || isActive ? 'light' : 'subtle'}
                >
                  {isComplete ? (
                    <Check size={14} />
                  ) : (
                    <Text style={{ fontSize: 11, fontWeight: 600 }}>{index + 1}</Text>
                  )}
                </ThemeIcon>
                <Box style={{ minWidth: 0 }}>
                  <Text c="#182230" style={{ fontSize: 13, fontWeight: 600, lineHeight: '17px' }}>
                    {step.label}
                  </Text>
                  <Text c="#64748b" mt={1} lineClamp={1} style={{ fontSize: 11, fontWeight: 500, lineHeight: '15px' }}>
                    {step.helper}
                  </Text>
                </Box>
              </Group>
            </UnstyledButton>
          );
        })}
      </Stack>
    </Card>
  );
}

function AssistantPanel() {
  const tasks = getOpenOperationalTasks({ reservation: 'ST1842', limit: 3 });

  return (
    <Card p={16} radius={radius.lg} style={cardStyle}>
      <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
        Check-in Tasks
      </Text>
      <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px' }}>
        Contextual tasks for this guest.
      </Text>
      <Stack mt={12} gap={spacing[3]}>
        {tasks.map((task) => (
          <OperationalTaskCard key={task.id} task={task} compact />
        ))}
      </Stack>
    </Card>
  );
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <Stack gap={spacing[5]}>
      <StepHeader
        title={`Welcome ${guest.name}`}
        helper="Confirm who is standing at the desk before starting the guided check-in."
        icon={<UserCheck size={20} />}
      />
      <Group gap={spacing[2]}>
        <SoftBadge>VIP</SoftBadge>
        <SoftBadge>Returning Guest</SoftBadge>
        <SoftBadge tone={colors.semantic.info}>Gold Loyalty</SoftBadge>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing={spacing[3]}>
        {[
          ['Booking ID', guest.bookingId],
          ['Room', `${guest.room} - ${guest.roomType}`],
          ['Arrival Time', guest.arrival],
          ['Stay Dates', guest.stayDates],
          ['Guests', `${guest.adults} adults, ${guest.children} child`],
        ].map(([label, value]) => (
          <Paper key={label} p={14} radius={radius.lg} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <Text c="#64748b" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
              {label}
            </Text>
            <Text c="#182230" mt={4} style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
              {value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <Paper p={14} radius={radius.lg} style={{ background: '#fbfdff', border: '1px solid #e2e8f0' }}>
        <Group justify="space-between">
          <Box>
            <Text c="#101828" style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
              Check-in readiness summary
            </Text>
            <Text c="#64748b" mt={4} style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
              {guest.readiness}% ready. Identity verification is the only blocker.
            </Text>
          </Box>
          <Text c={colors.brand[600]} style={{ fontSize: 22, fontWeight: 700, lineHeight: '28px' }}>
            {guest.readiness}%
          </Text>
        </Group>
        <Group mt={spacing[3]} gap={spacing[2]}>
          {readinessSummary.map((item) => (
            <SoftBadge key={item.label} tone={item.complete ? colors.semantic.success : colors.semantic.warning}>
              {item.label}
            </SoftBadge>
          ))}
        </Group>
      </Paper>
      <Group justify="flex-end">
        <Button color="stayosBrand" size="md" onClick={onStart} style={{ fontWeight: 600 }}>
          Start Check-in
        </Button>
      </Group>
    </Stack>
  );
}

function IdentityStep({ onConfirm }: { onConfirm: () => void }) {
  return (
    <Stack gap={spacing[5]}>
      <StepHeader
        title="Verify Identity"
        helper="Choose one capture method. StayOS will simulate OCR and fill the preview."
        icon={<ShieldCheck size={20} />}
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        {documentMethods.map((method) => (
          <Paper
            key={method.title}
            className={styles.methodCard}
            p={14}
            radius={radius.lg}
            style={{ ...cardStyle, '--stayos-accent': colors.brand[500] } as CSSProperties}
          >
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={38}>
              <method.icon size={18} />
            </ThemeIcon>
            <Text mt={spacing[3]} c="#101828" style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
              {method.title}
            </Text>
            <Text mt={4} c="#64748b" style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
              {method.detail}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <Paper p={14} radius={radius.lg} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
        <Group justify="space-between">
          <Text c="#101828" style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
            OCR extracted details preview
          </Text>
          <SoftBadge tone={colors.semantic.warning}>Needs confirmation</SoftBadge>
        </Group>
        <SimpleGrid mt={spacing[4]} cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
          {extractedFields.map(([label, value]) => (
            <Box key={label}>
              <Text c="#64748b" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
                {label}
              </Text>
              <Text c="#182230" mt={4} style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
                {value}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Paper>
      <Group justify="flex-end">
        <Button color="stayosBrand" onClick={onConfirm} style={{ fontWeight: 600 }}>
          Confirm Identity
        </Button>
      </Group>
    </Stack>
  );
}

function PhotoStep({
  onCapture,
  onSkip,
}: {
  onCapture: () => void;
  onSkip: () => void;
}) {
  return (
    <Stack gap={spacing[5]}>
      <StepHeader
        title="Capture Guest Photo"
        helper="Use the fastest available option. This is simulated for now."
        icon={<Camera size={20} />}
      />
      <Paper p={16} radius={radius.lg} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
        <Group justify="space-between" align="center">
          <Group gap={spacing[3]}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.full} size={46}>
              <Laptop size={20} />
            </ThemeIcon>
            <Box>
              <Text c="#101828" style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
                Webcam Ready
              </Text>
              <Text c="#64748b" mt={4} style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
                Reception counter camera detected.
              </Text>
            </Box>
          </Group>
          <SoftBadge tone={colors.semantic.success}>Ready</SoftBadge>
        </Group>
      </Paper>
      <Group gap={spacing[3]}>
        <Button color="stayosBrand" leftSection={<Camera size={16} />} onClick={onCapture} style={{ fontWeight: 600 }}>
          Capture Photo
        </Button>
        <Button variant="subtle" color="gray" leftSection={<QrCode size={16} />}>
          Use Mobile
        </Button>
        <Button variant="subtle" color="gray" leftSection={<FileImage size={16} />}>
          Upload
        </Button>
        <Button variant="subtle" color="gray" onClick={onSkip}>
          Mark Not Required
        </Button>
      </Group>
    </Stack>
  );
}

function RoomStep({ onChoose }: { onChoose: () => void }) {
  return (
    <Stack gap={spacing[5]}>
      <StepHeader
        title="Choose Room"
        helper="Show only the assigned room and three useful suggestions."
        icon={<BedDouble size={20} />}
      />
      <Paper p={14} radius={radius.lg} style={{ background: '#fbfdff', border: '1px solid #e2e8f0' }}>
        <Group justify="space-between">
          <Box>
            <Text c="#101828" style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
              Room 402
            </Text>
            <Text c="#64748b" mt={4} style={{ fontSize: 12, fontWeight: 400, lineHeight: '17px' }}>
              Premium Suite. Clean, inspected, and ready for arrival.
            </Text>
          </Box>
          <SoftBadge tone={colors.semantic.success}>Ready</SoftBadge>
        </Group>
      </Paper>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
        {roomSuggestions.map((room, index) => (
          <Paper
            key={room.room}
            className={styles.roomCard}
            p={14}
            radius={radius.lg}
            style={
              {
                ...cardStyle,
                '--stayos-accent': colors.brand[500],
                borderColor: index === 0 ? colors.brand[500] : colors.border.subtle,
              } as CSSProperties
            }
          >
            <Text c="#101828" style={{ fontSize: 16, fontWeight: 700, lineHeight: '22px' }}>
              Room {room.room}
            </Text>
            <Text c="#64748b" mt={4} style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
              {room.type}
            </Text>
            <Text c="#64748b" mt={spacing[3]} style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px' }}>
              {room.note}
            </Text>
            <Box mt={spacing[3]}>
              <SoftBadge tone={index === 0 ? colors.semantic.success : colors.text.body}>
                {room.status}
              </SoftBadge>
            </Box>
          </Paper>
        ))}
      </SimpleGrid>
      <Group justify="flex-end">
        <Button color="stayosBrand" onClick={onChoose} style={{ fontWeight: 600 }}>
          Choose Room 402
        </Button>
      </Group>
    </Stack>
  );
}

function PaymentStep({ onReceive }: { onReceive: () => void }) {
  return (
    <Stack gap={spacing[5]}>
      <StepHeader
        title="Receive Payment"
        helper="Show only what may block check-in."
        icon={<CreditCard size={20} />}
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
        {[
          ['Balance', 'INR 0', colors.semantic.success],
          ['Deposit', 'INR 5,000 suggested', colors.semantic.warning],
          ['Payment Status', 'Advance paid', colors.semantic.success],
        ].map(([label, value, tone]) => (
          <Paper key={label} p={14} radius={radius.lg} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <Text c="#64748b" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
              {label}
            </Text>
            <Text c={tone} mt={4} style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
              {value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <Group justify="flex-end">
        <Button variant="subtle" color="gray">
          Mark Paid
        </Button>
        <Button color="stayosBrand" leftSection={<CreditCard size={16} />} onClick={onReceive} style={{ fontWeight: 600 }}>
          Receive Payment
        </Button>
      </Group>
    </Stack>
  );
}

function KeysStep({
  identityVerified,
  onIssue,
}: {
  identityVerified: boolean;
  onIssue: () => void;
}) {
  return (
    <Stack gap={spacing[5]}>
      <StepHeader
        title="Issue Keys"
        helper="Final check before the guest receives room access."
        icon={<KeyRound size={20} />}
      />
      <Stack gap={spacing[3]}>
        {[
          ['Identity verified', identityVerified],
          ['Room 402 selected', true],
          ['Payment ready', true],
          ['Registration card ready', true],
          ['Wi-Fi details ready', true],
        ].map(([label, complete]) => (
          <Paper key={String(label)} p={12} radius={radius.md} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <Group gap={spacing[3]}>
              <ThemeIcon color={complete ? 'stayosBrand' : 'yellow'} variant="light" radius={radius.full} size={28}>
                {complete ? <Check size={15} /> : <FileCheck2 size={15} />}
              </ThemeIcon>
              <Text c="#182230" style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
                {label}
              </Text>
            </Group>
          </Paper>
        ))}
      </Stack>
      <Paper p={14} radius={radius.lg} style={{ background: '#fbfdff', border: '1px solid #e2e8f0' }}>
        <Group gap={spacing[3]}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.full}>
            <MonitorUp size={16} />
          </ThemeIcon>
          <Box>
            <Text c="#101828" style={{ fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
              Room key encoder ready
            </Text>
            <Text c="#64748b" mt={4} style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px' }}>
              Two keys will be prepared for Room 402.
            </Text>
          </Box>
        </Group>
      </Paper>
      <Group justify="flex-end">
        <Button
          color="stayosBrand"
          disabled={!identityVerified}
          leftSection={<KeyRound size={16} />}
          onClick={onIssue}
          style={{ fontWeight: 600 }}
        >
          Issue Room Keys
        </Button>
      </Group>
    </Stack>
  );
}

function CompleteStep() {
  return (
    <Stack gap={spacing[5]} align="center" ta="center">
      <ThemeIcon color="stayosBrand" variant="light" radius={radius.full} size={64}>
        <BadgeCheck size={34} />
      </ThemeIcon>
      <Box>
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 700, lineHeight: '38px' }}>
          Guest has arrived.
        </Title>
        <Text c="#64748b" mt={spacing[2]} style={{ fontSize: 15, fontWeight: 400, lineHeight: '24px' }}>
          Room keys issued. Welcome message sent.
        </Text>
      </Box>
      <Group gap={spacing[2]}>
        <SoftBadge tone={colors.semantic.success}>Room keys issued</SoftBadge>
        <SoftBadge tone={colors.semantic.success}>Welcome message sent</SoftBadge>
      </Group>
      <Button component="a" href="/" color="stayosBrand" style={{ fontWeight: 600 }}>
        Return to Front Desk
      </Button>
    </Stack>
  );
}

function ActiveStep({
  step,
  state,
  setState,
  goTo,
}: {
  step: StepKey;
  state: CheckInState;
  setState: (updater: (current: CheckInState) => CheckInState) => void;
  goTo: (step: StepKey) => void;
}) {
  if (step === 'welcome') {
    return (
      <WelcomeStep
        onStart={() => {
          setState((current) => ({ ...current, started: true }));
          goTo('identity');
        }}
      />
    );
  }

  if (step === 'identity') {
    return (
      <IdentityStep
        onConfirm={() => {
          setState((current) => ({ ...current, identityVerified: true }));
          goTo('photo');
        }}
      />
    );
  }

  if (step === 'photo') {
    return (
      <PhotoStep
        onCapture={() => {
          setState((current) => ({ ...current, photoCaptured: true }));
          goTo('room');
        }}
        onSkip={() => {
          setState((current) => ({ ...current, photoNotRequired: true }));
          goTo('room');
        }}
      />
    );
  }

  if (step === 'room') {
    return (
      <RoomStep
        onChoose={() => {
          setState((current) => ({ ...current, roomChosen: true }));
          goTo('payment');
        }}
      />
    );
  }

  if (step === 'payment') {
    return (
      <PaymentStep
        onReceive={() => {
          setState((current) => ({ ...current, paymentReceived: true }));
          goTo('keys');
        }}
      />
    );
  }

  if (step === 'keys') {
    return (
      <KeysStep
        identityVerified={state.identityVerified}
        onIssue={() => {
          setState((current) => ({ ...current, keysIssued: true }));
          goTo('complete');
        }}
      />
    );
  }

  return <CompleteStep />;
}

export default function CheckInPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<CheckInState>({
    started: false,
    identityVerified: false,
    photoCaptured: false,
    photoNotRequired: false,
    roomChosen: false,
    paymentReceived: false,
    keysIssued: false,
  });
  const activeStep = steps[currentStep];
  const activeKey = activeStep.key;
  const stepNumber = useMemo(() => currentStep + 1, [currentStep]);

  const goTo = (step: StepKey) => {
    setCurrentStep(steps.findIndex((item) => item.key === step));
  };

  const blockers = [
    { label: 'Identity pending', ready: state.identityVerified, tone: state.identityVerified ? colors.semantic.success : colors.semantic.warning },
    { label: 'Payment ready', ready: state.paymentReceived, tone: state.paymentReceived ? colors.semantic.success : colors.semantic.info },
    { label: 'Room ready', ready: state.roomChosen, tone: state.roomChosen ? colors.semantic.success : colors.semantic.info },
  ];

  return (
    <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[5]}>
      <Box style={{ gridColumn: 'span 3' }}>
        <ProgressSidebar currentStep={currentStep} state={state} onSelect={setCurrentStep} />
      </Box>

      <Box style={{ gridColumn: 'span 6' }}>
        <Card p={24} radius={radius.lg} style={{ ...cardStyle, minHeight: 620 }}>
          <Group justify="space-between" mb={spacing[5]}>
            <Text c="#64748b" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
              Step {stepNumber} of {steps.length}
            </Text>
            <SoftBadge tone={activeKey === 'complete' ? colors.semantic.success : colors.brand[600]}>
              {activeStep.label}
            </SoftBadge>
          </Group>
          <ActiveStep step={activeKey} state={state} setState={setState} goTo={goTo} />
        </Card>
      </Box>

      <Stack gap={spacing[5]} style={{ gridColumn: 'span 3' }}>
        <Card p={16} radius={radius.lg} style={cardStyle}>
          <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
            Current Guest
          </Text>
          <Divider my={spacing[3]} color={colors.border.subtle} />
          <Stack gap={spacing[2]}>
            <Text c="#101828" style={{ fontSize: 16, fontWeight: 700, lineHeight: '22px' }}>
              {guest.name}
            </Text>
            <Text c="#64748b" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
              {guest.bookingId} - {guest.stayDates}
            </Text>
            <Text c="#526383" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
              {guest.room} - {guest.roomType}
            </Text>
            <Button
              component={Link}
              href="/guests/ananya-rao"
              size="compact-sm"
              variant="light"
              color="stayosBrand"
              style={{ fontWeight: 600 }}
            >
              Open Guest 360
            </Button>
          </Stack>
        </Card>

        <Card p={16} radius={radius.lg} style={cardStyle}>
          <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
            Check-in Blockers
          </Text>
          <Stack mt={12} gap={8}>
            {blockers.map((item) => (
              <Group key={item.label} justify="space-between" wrap="nowrap">
                <Text c="#334155" style={{ fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
                  {item.label}
                </Text>
                <SoftBadge tone={item.tone}>{item.ready ? 'Ready' : 'Pending'}</SoftBadge>
              </Group>
            ))}
          </Stack>
        </Card>

        <AssistantPanel />
      </Stack>
    </SimpleGrid>
  );
}
