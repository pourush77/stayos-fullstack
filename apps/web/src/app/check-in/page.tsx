'use client';

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
import { brandPalettes, colors, radius, shadows, spacing, typography } from '@stayos/theme';
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
  { key: 'welcome', label: 'Welcome Guest', helper: 'Confirm the guest and stay.' },
  { key: 'identity', label: 'Verify Identity', helper: 'Required before keys.' },
  { key: 'photo', label: 'Capture Guest Photo', helper: 'Based on property rules.' },
  { key: 'room', label: 'Choose Room', helper: 'Select one ready room.' },
  { key: 'payment', label: 'Receive Payment', helper: 'Clear payment blockers.' },
  { key: 'keys', label: 'Issue Keys', helper: 'Final arrival checklist.' },
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

const documentMethods = [
  { title: 'Scan using Mobile', detail: 'Show QR code for secure guest upload.', icon: QrCode },
  { title: 'Capture using Webcam', detail: 'Use the reception counter camera.', icon: Camera },
  { title: 'Scanner or MFP', detail: 'Import from the connected scanner.', icon: ScanLine },
  { title: 'Upload Image or PDF', detail: 'Use an existing scan or file.', icon: FileImage },
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
  { room: '402', type: 'Premium Suite', status: 'Ready Now', note: 'High floor, garden view' },
  { room: '407', type: 'Premium Suite', status: 'Ready in 20 min', note: 'Near elevator' },
  { room: '501', type: 'Suite', status: 'Held for VIP', note: 'Airport pickup arrival' },
];

const readinessSummary = [
  { label: 'Reservation Ready', complete: true },
  { label: 'Room Ready', complete: true },
  { label: 'Payment Complete', complete: true },
  { label: 'Identity Pending', complete: false },
];

function toneBackground(tone: string) {
  if (tone === colors.semantic.warning) return brandPalettes.gold[50];
  if (tone === colors.semantic.info) return brandPalettes.blue[50];
  return colors.brand[50];
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
          fontWeight: typography.weights.semibold,
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
        <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.body}>
          {helper}
        </Text>
      </Box>
    </Group>
  );
}

function MoreDetails({ children }: { children: ReactNode }) {
  return (
    <details style={{ marginTop: spacing[4] }}>
      <summary
        style={{
          color: colors.brand[600],
          cursor: 'pointer',
          fontSize: typography.styles.label.fontSize,
          fontWeight: typography.weights.semibold,
        }}
      >
        More details
      </summary>
      <Box mt={spacing[3]}>{children}</Box>
    </details>
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
    <Card className={styles.stepRail} p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Button
        component="a"
        href="/"
        variant="subtle"
        color="gray"
        leftSection={<ChevronLeft size={16} />}
        px={0}
        mb={spacing[4]}
      >
        Back to Front Desk
      </Button>
      <Text c={colors.text.strong} style={typography.styles.label}>
        Check-in Progress
      </Text>
      <Progress
        mt={spacing[3]}
        value={(Object.values(completeByStep).filter(Boolean).length / steps.length) * 100}
        color="stayosBrand"
        radius={radius.full}
      />
      <Stack mt={spacing[5]} gap={spacing[2]}>
        {steps.map((step, index) => {
          const isActive = currentStep === index;
          const isComplete = completeByStep[step.key];

          return (
            <UnstyledButton
              key={step.key}
              onClick={() => onSelect(index)}
              style={{
                background: isActive ? colors.brand[50] : colors.surface.base,
                border: `1px solid ${isActive ? colors.brand[200] : colors.border.subtle}`,
                borderRadius: radius.md,
                padding: spacing[3],
                width: '100%',
              }}
            >
              <Group gap={spacing[3]} align="flex-start" wrap="nowrap">
                <ThemeIcon
                  color={isComplete || isActive ? 'stayosBrand' : 'gray'}
                  radius={radius.full}
                  size={28}
                  variant={isComplete || isActive ? 'light' : 'subtle'}
                >
                  {isComplete ? <Check size={15} /> : <Text style={typography.styles.caption}>{index + 1}</Text>}
                </ThemeIcon>
                <Box>
                  <Text c={colors.text.strong} style={typography.styles.label}>
                    {step.label}
                  </Text>
                  <Text c={colors.text.muted} mt={2} style={typography.styles.caption}>
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
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Text c={colors.text.strong} style={typography.styles.label}>
        Task Engine
      </Text>
      <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
        Contextual tasks for this guest.
      </Text>
      <Stack mt={spacing[4]} gap={spacing[3]}>
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
          <Paper key={label} p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              {label}
            </Text>
            <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
              {value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <Paper p={spacing[4]} radius={radius.lg} bg={colors.brand[50]}>
        <Group justify="space-between">
          <Box>
            <Text c={colors.text.strong} style={typography.styles.label}>
              Check-in readiness summary
            </Text>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
              {guest.readiness}% ready. Identity verification is the only blocker.
            </Text>
          </Box>
          <Text c={colors.brand[600]} style={typography.styles.h2}>
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
        <Button color="stayosBrand" size="md" onClick={onStart}>
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
            p={spacing[4]}
            radius={radius.lg}
            withBorder
            style={
              {
                '--stayos-accent': colors.brand[500],
                '--stayos-hover-shadow': shadows.sm,
              } as CSSProperties
            }
          >
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={38}>
              <method.icon size={18} />
            </ThemeIcon>
            <Text mt={spacing[3]} c={colors.text.strong} style={typography.styles.label}>
              {method.title}
            </Text>
            <Text mt={spacing[1]} c={colors.text.muted} style={typography.styles.small}>
              {method.detail}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <Paper p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
        <Group justify="space-between">
          <Text c={colors.text.strong} style={typography.styles.label}>
            OCR extracted details preview
          </Text>
          <SoftBadge tone={colors.semantic.warning}>Needs confirmation</SoftBadge>
        </Group>
        <SimpleGrid mt={spacing[4]} cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
          {extractedFields.map(([label, value]) => (
            <Box key={label}>
              <Text c={colors.text.muted} style={typography.styles.caption}>
                {label}
              </Text>
              <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
                {value}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Paper>
      <MoreDetails>
        <Text c={colors.text.body} style={typography.styles.small}>
          Family guest verification and foreign guest FRRO fields will appear here when required.
        </Text>
      </MoreDetails>
      <Group justify="flex-end">
        <Button color="stayosBrand" onClick={onConfirm}>
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
      <Paper p={spacing[5]} radius={radius.lg} bg={colors.surface.subtle}>
        <Group justify="space-between" align="center">
          <Group gap={spacing[3]}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.full} size={46}>
              <Laptop size={20} />
            </ThemeIcon>
            <Box>
              <Text c={colors.text.strong} style={typography.styles.label}>
                Webcam Ready
              </Text>
              <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
                Reception counter camera detected.
              </Text>
            </Box>
          </Group>
          <SoftBadge tone={colors.semantic.success}>Ready</SoftBadge>
        </Group>
      </Paper>
      <Group gap={spacing[3]}>
        <Button color="stayosBrand" leftSection={<Camera size={16} />} onClick={onCapture}>
          Capture Photo
        </Button>
        <Button variant="light" color="stayosBrand">
          Retake
        </Button>
        <Button variant="subtle" color="gray" leftSection={<QrCode size={16} />}>
          Use Mobile Camera
        </Button>
        <Button variant="subtle" color="gray" leftSection={<FileImage size={16} />}>
          Upload Photo
        </Button>
      </Group>
      <MoreDetails>
        <Button variant="subtle" color="gray" onClick={onSkip}>
          Mark as Not Required
        </Button>
      </MoreDetails>
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
      <Paper p={spacing[4]} radius={radius.lg} bg={colors.brand[50]}>
        <Group justify="space-between">
          <Box>
            <Text c={colors.text.strong} style={typography.styles.label}>
              Assigned Room
            </Text>
            <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.small}>
              Suite 402 is clean, inspected, and ready for arrival.
            </Text>
          </Box>
          <SoftBadge tone={colors.semantic.success}>Ready Now</SoftBadge>
        </Group>
      </Paper>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
        {roomSuggestions.map((room, index) => (
          <Paper
            key={room.room}
            className={styles.roomCard}
            p={spacing[4]}
            radius={radius.lg}
            withBorder
            style={
              {
                '--stayos-accent': colors.brand[500],
                '--stayos-hover-shadow': shadows.sm,
                borderColor: index === 0 ? colors.brand[500] : colors.border.subtle,
              } as CSSProperties
            }
          >
            <Text c={colors.text.strong} style={typography.styles.h3}>
              Room {room.room}
            </Text>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
              {room.type}
            </Text>
            <Text c={colors.text.body} mt={spacing[3]} style={typography.styles.caption}>
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
        <Button color="stayosBrand" onClick={onChoose}>
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
          <Paper key={label} p={spacing[4]} radius={radius.lg} bg={colors.surface.subtle}>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              {label}
            </Text>
            <Text c={tone} mt={spacing[1]} style={typography.styles.label}>
              {value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <Group justify="flex-end">
        <Button variant="subtle" color="gray">
          Mark Paid
        </Button>
        <Button color="stayosBrand" leftSection={<CreditCard size={16} />} onClick={onReceive}>
          Receive Payment
        </Button>
      </Group>
      <MoreDetails>
        <Text c={colors.text.body} style={typography.styles.small}>
          Role permissions will control whether a receptionist can waive deposit or mark a balance as paid.
        </Text>
      </MoreDetails>
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
          <Paper key={String(label)} p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
            <Group gap={spacing[3]}>
              <ThemeIcon color={complete ? 'stayosBrand' : 'yellow'} variant="light" radius={radius.full} size={28}>
                {complete ? <Check size={15} /> : <FileCheck2 size={15} />}
              </ThemeIcon>
              <Text c={colors.text.strong} style={typography.styles.label}>
                {label}
              </Text>
            </Group>
          </Paper>
        ))}
      </Stack>
      <Paper p={spacing[4]} radius={radius.lg} bg={colors.brand[50]}>
        <Group gap={spacing[3]}>
          <ThemeIcon color="stayosBrand" variant="light" radius={radius.full}>
            <MonitorUp size={16} />
          </ThemeIcon>
          <Box>
            <Text c={colors.text.strong} style={typography.styles.label}>
              Room key encoder ready
            </Text>
            <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.caption}>
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
      <ThemeIcon color="stayosBrand" variant="light" radius={radius.full} size={76}>
        <BadgeCheck size={34} />
      </ThemeIcon>
      <Box>
        <Title order={1} c={colors.text.strong} style={typography.styles.h1}>
          Guest has arrived.
        </Title>
        <Text c={colors.text.body} mt={spacing[2]} style={typography.styles.bodyLarge}>
          Room keys issued. Welcome message sent.
        </Text>
      </Box>
      <Group gap={spacing[2]}>
        <SoftBadge tone={colors.semantic.success}>Room keys issued</SoftBadge>
        <SoftBadge tone={colors.semantic.success}>Welcome message sent</SoftBadge>
      </Group>
      <Button component="a" href="/" color="stayosBrand">
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

  return (
    <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[5]}>
      <Box style={{ gridColumn: 'span 3' }}>
        <ProgressSidebar currentStep={currentStep} state={state} onSelect={setCurrentStep} />
      </Box>

      <Box style={{ gridColumn: 'span 6' }}>
        <Card p={spacing[6]} radius={radius.lg} shadow="xs" style={{ border: 'none', minHeight: 620 }}>
          <Group justify="space-between" mb={spacing[5]}>
            <Text c={colors.text.muted} style={typography.styles.label}>
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
        <AssistantPanel />
        <Card p={spacing[4]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
          <Text c={colors.text.strong} style={typography.styles.label}>
            Current guest
          </Text>
          <Divider my={spacing[3]} color={colors.border.subtle} />
          <Stack gap={spacing[2]}>
            <Text c={colors.text.strong} style={typography.styles.h3}>
              {guest.name}
            </Text>
            <Text c={colors.text.muted} style={typography.styles.small}>
              {guest.bookingId} - {guest.roomType}
            </Text>
            <SoftBadge tone={colors.brand[600]}>{guest.room}</SoftBadge>
            <Button component="a" href="/guests/ananya-rao" size="xs" variant="light" color="stayosBrand">
              Open Guest 360
            </Button>
          </Stack>
        </Card>
      </Stack>
    </SimpleGrid>
  );
}
