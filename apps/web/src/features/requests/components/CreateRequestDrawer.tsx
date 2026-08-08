import {
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Transition,
} from '@mantine/core';
import {
  AlarmClock,
  Baby,
  BedDouble,
  CakeSlice,
  Car,
  CheckCircle2,
  ConciergeBell,
  Droplets,
  Flower2,
  Plane,
  Shirt,
  Sparkles,
  SprayCan,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import type {
  GuestRequestDepartment,
  GuestRequestPriority,
  GuestRequestSuggestionDto,
  GuestRequestType,
} from '../api/guest-requests-api';

type GuestServiceDefinition = {
  type: GuestRequestType;
  title: string;
  department: GuestRequestDepartment;
  icon: ReactNode;
  helper: string;
  disabled?: boolean;
};

type ServiceDetails = {
  scheduledAt?: string;
  destination?: string;
  pickupLocation?: string;
  dropLocation?: string;
  flightNumber?: string;
  passengers?: number;
  quantity?: number;
  repeatCall?: boolean;
};

const guestServices: GuestServiceDefinition[] = [
  {
    type: 'WAKE_UP_CALL',
    title: 'Wake-up Call',
    department: 'RECEPTION',
    icon: <AlarmClock size={17} />,
    helper: 'Schedule a wake-up time',
  },
  {
    type: 'AIRPORT_PICKUP',
    title: 'Airport Pickup',
    department: 'CONCIERGE',
    icon: <Plane size={17} />,
    helper: 'Arrange arrival transfer',
    disabled: true,
  },
  {
    type: 'AIRPORT_DROP',
    title: 'Airport Drop',
    department: 'CONCIERGE',
    icon: <Plane size={17} />,
    helper: 'Arrange departure transfer',
    disabled: true,
  },
  {
    type: 'TAXI',
    title: 'Taxi',
    department: 'CONCIERGE',
    icon: <Car size={17} />,
    helper: 'Book a local ride',
    disabled: true,
  },
  {
    type: 'LAUNDRY_PICKUP',
    title: 'Laundry',
    department: 'LAUNDRY',
    icon: <Shirt size={17} />,
    helper: 'Schedule laundry pickup',
  },
  {
    type: 'EXTRA_TOWELS',
    title: 'Extra Towels',
    department: 'HOUSEKEEPING',
    icon: <Sparkles size={17} />,
    helper: 'Send fresh towels',
  },
  {
    type: 'ROOM_CLEANING',
    title: 'Room Cleaning',
    department: 'HOUSEKEEPING',
    icon: <SprayCan size={17} />,
    helper: 'Clean the guest room',
  },
  {
    type: 'WATER_BOTTLES',
    title: 'Water Bottles',
    department: 'HOUSEKEEPING',
    icon: <Droplets size={17} />,
    helper: 'Send drinking water',
  },
  {
    type: 'LUGGAGE_ASSISTANCE',
    title: 'Luggage Assistance',
    department: 'CONCIERGE',
    icon: <ConciergeBell size={17} />,
    helper: 'Call bell desk assistance',
  },
  {
    type: 'BABY_COT',
    title: 'Baby Cot',
    department: 'HOUSEKEEPING',
    icon: <Baby size={17} />,
    helper: 'Arrange a baby cot',
  },
  {
    type: 'EXTRA_BED',
    title: 'Extra Bed',
    department: 'HOUSEKEEPING',
    icon: <BedDouble size={17} />,
    helper: 'Arrange an extra bed',
  },
  {
    type: 'FLOWERS',
    title: 'Flowers',
    department: 'CONCIERGE',
    icon: <Flower2 size={17} />,
    helper: 'Arrange flowers',
  },
  {
    type: 'CAKE',
    title: 'Cake',
    department: 'F_AND_B',
    icon: <CakeSlice size={17} />,
    helper: 'Arrange a cake',
  },
  {
    type: 'SPECIAL_DECORATION',
    title: 'Decoration',
    department: 'CONCIERGE',
    icon: <Sparkles size={17} />,
    helper: 'Plan a special setup',
  },
  {
    type: 'OTHER',
    title: 'Other Request',
    department: 'RECEPTION',
    icon: <ConciergeBell size={17} />,
    helper: 'Create a custom request',
  },
];

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toIso(localDateTime?: string) {
  if (!localDateTime) return undefined;
  const date = new Date(localDateTime);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function requiresSchedule(type?: GuestRequestType) {
  return [
    'WAKE_UP_CALL',
    'AIRPORT_PICKUP',
    'AIRPORT_DROP',
    'TAXI',
    'LAUNDRY_PICKUP',
    'ROOM_CLEANING',
    'LUGGAGE_ASSISTANCE',
    'SPECIAL_DECORATION',
    'FLOWERS',
    'CAKE',
  ].includes(type ?? '');
}

function requiresQuantity(type?: GuestRequestType) {
  return ['EXTRA_TOWELS', 'WATER_BOTTLES', 'BABY_COT', 'EXTRA_BED'].includes(type ?? '');
}

function requiresPassengers(type?: GuestRequestType) {
  return ['AIRPORT_PICKUP', 'AIRPORT_DROP', 'TAXI'].includes(type ?? '');
}

export function CreateRequestDrawer({
  onClose,
  onCreate,
  opened,
  selected,
  context,
}: {
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
  opened: boolean;
  selected?: GuestRequestSuggestionDto;
  context?: {
    department?: GuestRequestDepartment;
    guestId?: string;
    reservationId?: string;
    roomId?: string;
  };
}) {
  const [requestType, setRequestType] = useState<GuestRequestType | undefined>(selected?.type);
  const [title, setTitle] = useState(selected?.title ?? '');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<GuestRequestPriority>('NORMAL');
  const [department, setDepartment] = useState<GuestRequestDepartment>(
    selected?.department ?? context?.department ?? 'RECEPTION',
  );
  const [details, setDetails] = useState<ServiceDetails>({});
  const [isCreating, setIsCreating] = useState(false);

  const selectedService = useMemo(
    () => guestServices.find((service) => service.type === requestType),
    [requestType],
  );

  useEffect(() => {
    setRequestType(selected?.type);
    setTitle(selected?.title ?? '');
    setDescription('');
    setPriority('NORMAL');
    setDepartment(selected?.department ?? context?.department ?? 'RECEPTION');
    setDetails({});
    setIsCreating(false);
  }, [context?.department, opened, selected]);

  const selectService = (service: GuestServiceDefinition) => {
    if (service.disabled) return;
    setRequestType(service.type);
    setTitle(service.title);
    setDepartment(service.department);
    setDetails({});
  };

  const updateDetails = <K extends keyof ServiceDetails>(key: K, value: ServiceDetails[K]) => {
    setDetails((current) => ({ ...current, [key]: value }));
  };

  const submitRequest = async () => {
    if (!requestType || !title.trim() || isCreating) return;

    const service = guestServices.find((item) => item.type === requestType);
    if (service?.disabled) return;

    setIsCreating(true);

    const dueAt = toIso(details.scheduledAt);
    const serviceDetails = Object.fromEntries(
      Object.entries(details).filter(
        ([key, value]) =>
          key !== 'scheduledAt' && value !== undefined && value !== null && value !== '',
      ),
    );

    try {
      await onCreate({
        ...context,
        requestType,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        department,
        dueAt,
        details: Object.keys(serviceDetails).length > 0 ? serviceDetails : undefined,
      });

      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={isCreating ? () => undefined : onClose}
      position="right"
      size="min(94vw, 560px)"
      title="Guest Services"
      closeButtonProps={{ disabled: isCreating }}
      overlayProps={{ backgroundOpacity: 0.22, blur: 2 }}
    >
      <Stack gap={spacing[4]}>
        <Paper
          p={spacing[4]}
          radius={radius.lg}
          style={{
            background: 'linear-gradient(135deg, #f8faff 0%, #f5f3ff 100%)',
            border: '1px solid #e8e7ff',
          }}
        >
          <Group gap={12} wrap="nowrap">
            <ThemeIcon color="stayosBrand" variant="light" radius={12} size={42}>
              <Sparkles size={19} />
            </ThemeIcon>
            <Box>
              <Text c={colors.text.strong} style={typography.styles.h3}>
                What does the guest need?
              </Text>
              <Text c={colors.text.muted} mt={2} style={typography.styles.small}>
                Choose a service. StayOS will route it and only ask for the details that matter.
              </Text>
            </Box>
          </Group>
        </Paper>

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={spacing[2]}>
          {guestServices.map((service) => {
            const active = requestType === service.type;

            return (
              <Button
                key={service.type}
                variant={active ? 'filled' : 'light'}
                color={active ? 'stayosBrand' : 'gray'}
                justify="flex-start"
                leftSection={service.icon}
                disabled={isCreating || service.disabled}
                onClick={() => selectService(service)}
                styles={{
                  root: {
                    minHeight: service.disabled ? 58 : 48,
                    opacity: service.disabled ? 0.58 : 1,
                    cursor: service.disabled ? 'not-allowed' : 'pointer',
                    transition: 'transform 150ms ease, box-shadow 150ms ease',
                  },
                  inner: { justifyContent: 'flex-start', width: '100%' },
                  label: { width: '100%' },
                }}
              >
                <Group justify="space-between" gap={8} wrap="nowrap" style={{ width: '100%' }}>
                  <Box style={{ minWidth: 0, textAlign: 'left' }}>
                    <Text size="sm" fw={700}>
                      {service.title}
                    </Text>
                    {service.disabled ? (
                      <Text c="#94a3b8" mt={1} style={{ fontSize: 10.5, lineHeight: '13px' }}>
                        Not available yet
                      </Text>
                    ) : null}
                  </Box>
                </Group>
              </Button>
            );
          })}
        </SimpleGrid>

        <Transition mounted={Boolean(requestType)} transition="fade-up" duration={180}>
          {(styles) => (
            <Stack gap={spacing[4]} style={styles}>
              {selectedService ? (
                <Paper
                  p={spacing[3]}
                  radius={radius.md}
                  style={{
                    background: '#fbfcff',
                    border: '1px solid #e7eaf0',
                  }}
                >
                  <Group justify="space-between" gap={spacing[2]}>
                    <Group gap={10}>
                      <ThemeIcon color="stayosBrand" variant="light" radius={10} size={34}>
                        {selectedService.icon}
                      </ThemeIcon>
                      <Box>
                        <Text c={colors.text.strong} fw={800} size="sm">
                          {selectedService.title}
                        </Text>
                        <Text c={colors.text.muted} size="xs">
                          {selectedService.helper}
                        </Text>
                      </Box>
                    </Group>
                    <Badge color="stayosBrand" variant="light">
                      {label(department)}
                    </Badge>
                  </Group>
                </Paper>
              ) : null}

              {requiresSchedule(requestType) ? (
                <TextInput
                  type="datetime-local"
                  label={
                    requestType === 'WAKE_UP_CALL'
                      ? 'Wake-up time'
                      : requestType === 'LAUNDRY_PICKUP'
                        ? 'Pickup time'
                        : requestType === 'ROOM_CLEANING'
                          ? 'Preferred time'
                          : 'Date & time'
                  }
                  description="Leave empty if the guest wants this as soon as possible."
                  value={details.scheduledAt ?? ''}
                  disabled={isCreating}
                  onChange={(event) => updateDetails('scheduledAt', event.currentTarget.value)}
                />
              ) : null}

              {requestType === 'WAKE_UP_CALL' ? (
                <Select
                  label="Call preference"
                  data={[
                    { label: 'One call', value: 'false' },
                    { label: 'Call again if unanswered', value: 'true' },
                  ]}
                  value={String(details.repeatCall ?? false)}
                  disabled={isCreating}
                  onChange={(value) => updateDetails('repeatCall', value === 'true')}
                />
              ) : null}

              {requestType === 'TAXI' ? (
                <TextInput
                  label="Destination"
                  placeholder="e.g. Indore Railway Station"
                  value={details.destination ?? ''}
                  disabled={isCreating}
                  onChange={(event) => updateDetails('destination', event.currentTarget.value)}
                />
              ) : null}

              {requestType === 'AIRPORT_PICKUP' ? (
                <TextInput
                  label="Pickup location"
                  placeholder="e.g. Indore Airport, Terminal 1"
                  value={details.pickupLocation ?? ''}
                  disabled={isCreating}
                  onChange={(event) => updateDetails('pickupLocation', event.currentTarget.value)}
                />
              ) : null}

              {requestType === 'AIRPORT_DROP' ? (
                <TextInput
                  label="Drop location"
                  placeholder="e.g. Indore Airport"
                  value={details.dropLocation ?? ''}
                  disabled={isCreating}
                  onChange={(event) => updateDetails('dropLocation', event.currentTarget.value)}
                />
              ) : null}

              {requestType === 'AIRPORT_PICKUP' || requestType === 'AIRPORT_DROP' ? (
                <TextInput
                  label="Flight number"
                  placeholder="Optional, e.g. 6E 238"
                  value={details.flightNumber ?? ''}
                  disabled={isCreating}
                  onChange={(event) => updateDetails('flightNumber', event.currentTarget.value)}
                />
              ) : null}

              {requiresPassengers(requestType) ? (
                <NumberInput
                  label="Passengers"
                  min={1}
                  max={20}
                  value={details.passengers ?? 1}
                  disabled={isCreating}
                  onChange={(value) =>
                    updateDetails(
                      'passengers',
                      typeof value === 'number' ? value : Number(value) || 1,
                    )
                  }
                />
              ) : null}

              {requiresQuantity(requestType) ? (
                <NumberInput
                  label="Quantity"
                  min={1}
                  max={20}
                  value={details.quantity ?? 1}
                  disabled={isCreating}
                  onChange={(value) =>
                    updateDetails(
                      'quantity',
                      typeof value === 'number' ? value : Number(value) || 1,
                    )
                  }
                />
              ) : null}

              <Textarea
                label={requestType === 'OTHER' ? 'Request details' : 'Anything else?'}
                placeholder={
                  requestType === 'OTHER'
                    ? 'Describe what the guest needs'
                    : 'Optional notes for the team'
                }
                minRows={3}
                value={description}
                disabled={isCreating}
                onChange={(event) => setDescription(event.currentTarget.value)}
              />

              <Select
                label="Priority"
                data={[
                  { label: 'Normal', value: 'NORMAL' },
                  { label: 'High', value: 'HIGH' },
                  { label: 'VIP', value: 'VIP' },
                ]}
                value={priority}
                disabled={isCreating}
                onChange={(value) => setPriority((value ?? 'NORMAL') as GuestRequestPriority)}
              />

              <Paper
                p={spacing[4]}
                radius={radius.lg}
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #dcfce7',
                }}
              >
                <Group gap={10} wrap="nowrap">
                  <ThemeIcon color="green" variant="light" radius={10} size={34}>
                    <CheckCircle2 size={17} />
                  </ThemeIcon>
                  <Box>
                    <Text c="#166534" fw={800} size="sm">
                      Smart Assignment
                    </Text>
                    <Text c="#4b7a59" mt={2} size="xs">
                      {title} will be sent to {label(department)} automatically.
                    </Text>
                  </Box>
                </Group>
              </Paper>
            </Stack>
          )}
        </Transition>

        <Button
          color="stayosBrand"
          size="md"
          leftSection={<CheckCircle2 size={17} />}
          disabled={
            !requestType ||
            !title.trim() ||
            guestServices.find((service) => service.type === requestType)?.disabled
          }
          loading={isCreating}
          onClick={() => void submitRequest()}
        >
          Create Request
        </Button>
      </Stack>
    </Drawer>
  );
}
