'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  Hotel,
  IndianRupee,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { brandPalettes, colors, radius, spacing, typography } from '@stayos/theme';
import { OperationalTaskCard } from '@stayos/ui';
import type { OperationalTask } from '@stayos/ui';

type StepKey =
  | 'search'
  | 'availability'
  | 'recommendation'
  | 'rate'
  | 'corporate'
  | 'create'
  | 'next';

const steps: { key: StepKey; label: string }[] = [
  { key: 'search', label: 'Search Stay' },
  { key: 'availability', label: 'Show Availability' },
  { key: 'recommendation', label: 'Recommendation' },
  { key: 'rate', label: 'Rate and Discount' },
  { key: 'corporate', label: 'Corporate Rate' },
  { key: 'create', label: 'Create Reservation' },
  { key: 'next', label: 'Next Action' },
];

const roomTypes = [
  {
    type: 'Deluxe King',
    available: 4,
    basePrice: 'INR 5,200',
    sellingPrice: 'INR 4,900',
    breakfast: 'Breakfast included',
    capacity: '2 adults',
    amenities: ['King bed', 'City view', 'Work desk'],
  },
  {
    type: 'Deluxe Twin',
    available: 2,
    basePrice: 'INR 5,000',
    sellingPrice: 'INR 4,700',
    breakfast: 'Breakfast optional',
    capacity: '2 adults',
    amenities: ['Twin beds', 'Quiet floor', 'Tea station'],
  },
  {
    type: 'Premium Suite',
    available: 1,
    basePrice: 'INR 8,800',
    sellingPrice: 'INR 8,200',
    breakfast: 'Breakfast included',
    capacity: '3 adults',
    amenities: ['Living area', 'Garden view', 'Extra bed ready'],
  },
  {
    type: 'Family Room',
    available: 3,
    basePrice: 'INR 7,200',
    sellingPrice: 'INR 6,900',
    breakfast: 'Breakfast included',
    capacity: '4 guests',
    amenities: ['Two beds', 'Child friendly', 'Near elevator'],
  },
];

const mockReservationTask: OperationalTask = {
  id: 'task-new-reservation-st1902',
  title: 'Reservation created',
  description: 'ST1902 for Priya Nair is ready for confirmation and pre-arrival follow-up.',
  department: 'Front Desk',
  priority: 'Normal',
  status: 'Pending',
  timestamp: 'Now',
  primaryAction: 'View Reservation',
  source: 'Reservation created',
  relatedGuest: 'Priya Nair',
  relatedReservation: 'ST1902',
};

function StepRail({ active, onSelect }: { active: StepKey; onSelect: (step: StepKey) => void }) {
  const activeIndex = steps.findIndex((step) => step.key === active);

  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Text c={colors.text.strong} style={typography.styles.label}>
        Selling Workflow
      </Text>
      <Stack mt={spacing[4]} gap={spacing[2]}>
        {steps.map((step, index) => {
          const isActive = step.key === active;
          const isComplete = index < activeIndex;

          return (
            <UnstyledButton
              key={step.key}
              onClick={() => onSelect(step.key)}
              style={{
                background: isActive ? colors.brand[50] : colors.surface.base,
                border: `1px solid ${isActive ? colors.brand[200] : colors.border.subtle}`,
                borderRadius: radius.md,
                padding: spacing[3],
                width: '100%',
              }}
            >
              <Group gap={spacing[3]} wrap="nowrap">
                <ThemeIcon
                  color={isActive || isComplete ? 'stayosBrand' : 'gray'}
                  variant={isActive || isComplete ? 'light' : 'subtle'}
                  radius={radius.full}
                  size={28}
                >
                  {isComplete ? <Check size={14} /> : <Text style={typography.styles.caption}>{index + 1}</Text>}
                </ThemeIcon>
                <Text c={colors.text.strong} style={typography.styles.label}>
                  {step.label}
                </Text>
              </Group>
            </UnstyledButton>
          );
        })}
      </Stack>
    </Card>
  );
}

function SectionHeader({ title, detail, icon }: { title: string; detail: string; icon: ReactNode }) {
  return (
    <Group gap={spacing[3]} align="flex-start" wrap="nowrap">
      <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={42}>
        {icon}
      </ThemeIcon>
      <Box>
        <Title order={2} c={colors.text.strong} style={typography.styles.h2}>
          {title}
        </Title>
        <Text c={colors.text.body} mt={spacing[1]} style={typography.styles.body}>
          {detail}
        </Text>
      </Box>
    </Group>
  );
}

function SearchStayStep({ onNext }: { onNext: () => void }) {
  return (
    <Stack gap={spacing[5]}>
      <SectionHeader
        title="Search Stay"
        detail="Answer availability and price in one quick search."
        icon={<CalendarDays size={20} />}
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[4]}>
        <DatePickerInput label="Check-in date" placeholder="Select check-in" />
        <DatePickerInput label="Check-out date" placeholder="Select check-out" />
        <NumberInput label="Adults" defaultValue={2} min={1} />
        <NumberInput label="Children" defaultValue={0} min={0} />
        <NumberInput label="Rooms needed" defaultValue={1} min={1} />
        <Select
          label="Source"
          defaultValue="Walk-in"
          data={['Walk-in', 'Phone', 'Corporate', 'OTA', 'Website']}
        />
      </SimpleGrid>
      <Group justify="flex-end">
        <Button color="stayosBrand" leftSection={<Search size={16} />} onClick={onNext}>
          Check Availability
        </Button>
      </Group>
    </Stack>
  );
}

function AvailabilityStep({ onNext }: { onNext: () => void }) {
  return (
    <Stack gap={spacing[5]}>
      <SectionHeader
        title="Available Rooms"
        detail="Room types that can be sold for this stay."
        icon={<Hotel size={20} />}
      />
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={spacing[4]}>
        {roomTypes.map((room) => (
          <Card key={room.type} p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
            <Group justify="space-between" align="flex-start">
              <Box>
                <Title order={3} c={colors.text.strong} style={typography.styles.h3}>
                  {room.type}
                </Title>
                <Text c={colors.text.muted} mt={spacing[1]} style={typography.styles.small}>
                  {room.capacity} - {room.breakfast}
                </Text>
              </Box>
              {room.available <= 2 ? (
                <Badge color="yellow" variant="light" radius={radius.full} styles={{ root: { textTransform: 'none' } }}>
                  Only {room.available} left
                </Badge>
              ) : (
                <Badge color="stayosBrand" variant="light" radius={radius.full} styles={{ root: { textTransform: 'none' } }}>
                  {room.available} available
                </Badge>
              )}
            </Group>
            <SimpleGrid mt={spacing[4]} cols={2} spacing={spacing[3]}>
              <Paper p={spacing[3]} radius={radius.md} bg={colors.surface.subtle}>
                <Text c={colors.text.muted} style={typography.styles.caption}>
                  Base price
                </Text>
                <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
                  {room.basePrice}
                </Text>
              </Paper>
              <Paper p={spacing[3]} radius={radius.md} bg={colors.brand[50]}>
                <Text c={colors.text.muted} style={typography.styles.caption}>
                  Today's selling price
                </Text>
                <Text c={colors.brand[600]} mt={spacing[1]} style={typography.styles.label}>
                  {room.sellingPrice}
                </Text>
              </Paper>
            </SimpleGrid>
            <Group mt={spacing[4]} gap={spacing[2]}>
              {room.amenities.map((amenity) => (
                <Badge key={amenity} color="gray" variant="light" radius={radius.full}>
                  {amenity}
                </Badge>
              ))}
            </Group>
          </Card>
        ))}
      </SimpleGrid>
      <Group justify="flex-end">
        <Button color="stayosBrand" onClick={onNext}>
          Show Best Option
        </Button>
      </Group>
    </Stack>
  );
}

function RecommendationStep({ onNext }: { onNext: () => void }) {
  return (
    <Stack gap={spacing[5]}>
      <SectionHeader
        title="Best Option"
        detail="StayOS recommends what to sell first."
        icon={<Sparkles size={20} />}
      />
      <Card p={spacing[6]} radius={radius.lg} shadow="xs" style={{ background: colors.brand[50], border: 'none' }}>
        <Badge color="stayosBrand" variant="light" radius={radius.full} styles={{ root: { textTransform: 'none' } }}>
          Best value
        </Badge>
        <Title order={2} c={colors.text.strong} mt={spacing[4]} style={typography.styles.h2}>
          Deluxe King at INR 4,900
        </Title>
        <Text c={colors.text.body} mt={spacing[2]} style={typography.styles.body}>
          Ready now, breakfast included, and fits the guest without manager approval.
        </Text>
      </Card>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
        {[
          ['Best for family', '2 Deluxe + 1 Suite'],
          ['Lowest price', '4 Deluxe rooms'],
          ['Upgrade opportunity', '2 Family Rooms'],
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
      <Group justify="flex-end">
        <Button color="stayosBrand" onClick={onNext}>
          Review Rate
        </Button>
      </Group>
    </Stack>
  );
}

function RateStep({ onNext }: { onNext: () => void }) {
  return (
    <Stack gap={spacing[5]}>
      <SectionHeader
        title="Rate and Discount"
        detail="Simple selling guardrails without rate-code language."
        icon={<IndianRupee size={20} />}
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={spacing[4]}>
        {[
          ['Current selling price', 'INR 4,900'],
          ['Reception discount allowed', 'INR 300'],
          ['Minimum selling price', 'INR 4,500'],
        ].map(([label, value]) => (
          <Paper key={label} p={spacing[5]} radius={radius.lg} bg={colors.surface.subtle}>
            <Text c={colors.text.muted} style={typography.styles.caption}>
              {label}
            </Text>
            <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.h3}>
              {value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <Paper p={spacing[4]} radius={radius.lg} bg={brandPalettes.gold[50]}>
        <Text c={colors.semantic.warning} style={typography.styles.label}>
          INR 300 discount available. Below INR 4,500 requires manager approval.
        </Text>
      </Paper>
      <Group justify="flex-end">
        <Button color="stayosBrand" onClick={onNext}>
          Continue
        </Button>
      </Group>
    </Stack>
  );
}

function CorporateStep({ onNext }: { onNext: () => void }) {
  return (
    <Stack gap={spacing[5]}>
      <SectionHeader
        title="Corporate Rate"
        detail="Shown when the enquiry source is Corporate."
        icon={<BriefcaseBusiness size={20} />}
      />
      <TextInput leftSection={<Search size={16} />} label="Search company" defaultValue="Jaipur Textiles Pvt Ltd" />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[4]}>
        {[
          ['Negotiated rate', 'INR 4,600'],
          ['Billing instruction', 'Company pays room only'],
          ['GST invoice', 'Required'],
          ['Credit facility', 'Active - INR 2,00,000 limit'],
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
      <Group justify="flex-end">
        <Button color="stayosBrand" onClick={onNext}>
          Create Reservation
        </Button>
      </Group>
    </Stack>
  );
}

function CreateReservationStep({ onCreate }: { onCreate: () => void }) {
  return (
    <Stack gap={spacing[5]}>
      <SectionHeader
        title="Create Reservation"
        detail="Only the guest details needed to hold the booking."
        icon={<Users size={20} />}
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[4]}>
        <TextInput label="Lead guest name" placeholder="Guest name" defaultValue="Priya Nair" />
        <TextInput label="Mobile number" placeholder="+91" defaultValue="+91 98765 44220" />
        <TextInput label="Email optional" placeholder="guest@example.com" />
        <Textarea label="Notes optional" placeholder="Anything the team should know" minRows={3} />
      </SimpleGrid>
      <Group justify="flex-end">
        <Button color="stayosBrand" leftSection={<BadgeCheck size={16} />} onClick={onCreate}>
          Create Reservation
        </Button>
      </Group>
    </Stack>
  );
}

function NextActionStep() {
  return (
    <Stack gap={spacing[5]}>
      <SectionHeader
        title="Reservation Created"
        detail="ST1902 is ready. What should happen next?"
        icon={<BadgeCheck size={20} />}
      />
      <OperationalTaskCard task={mockReservationTask} />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
        <Button component="a" href="/check-in" color="stayosBrand">
          Start Check-in Now
        </Button>
        <Button component="a" href="/reservations" variant="light" color="stayosBrand">
          View Reservation
        </Button>
        <Button component="a" href="/reservations/availability" variant="subtle" color="gray">
          Back to Availability
        </Button>
      </SimpleGrid>
    </Stack>
  );
}

function FuturePlaceholders() {
  return (
    <Card p={spacing[5]} radius={radius.lg} shadow="xs" style={{ border: 'none' }}>
      <Text c={colors.text.strong} style={typography.styles.label}>
        Future selling tools
      </Text>
      <Group mt={spacing[3]} gap={spacing[2]}>
        {['Packages', 'Promo codes', 'OTA rates', 'Corporate contracts', 'Group blocks', 'Manager approval', 'Dynamic pricing'].map(
          (item) => (
            <Badge key={item} color="gray" variant="light" radius={radius.full}>
              {item}
            </Badge>
          ),
        )}
      </Group>
    </Card>
  );
}

export default function AvailabilityWorkspacePage() {
  const [activeStep, setActiveStep] = useState<StepKey>('search');

  const activeIndex = useMemo(
    () => steps.findIndex((step) => step.key === activeStep) + 1,
    [activeStep],
  );

  return (
    <Grid gap={spacing[5]}>
      <Grid.Col span={{ base: 12, lg: 3 }}>
        <Stack gap={spacing[5]}>
          <Button
            component="a"
            href="/reservations"
            variant="subtle"
            color="gray"
            leftSection={<ChevronLeft size={16} />}
            px={0}
            w="fit-content"
          >
            Back to Reservations
          </Button>
          <StepRail active={activeStep} onSelect={setActiveStep} />
          <FuturePlaceholders />
        </Stack>
      </Grid.Col>

      <Grid.Col span={{ base: 12, lg: 9 }}>
        <Card p={spacing[6]} radius={radius.lg} shadow="xs" style={{ border: 'none', minHeight: 680 }}>
          <Group justify="space-between" mb={spacing[5]}>
            <Text c={colors.text.muted} style={typography.styles.label}>
              Step {activeIndex} of {steps.length}
            </Text>
            <Badge color="stayosBrand" variant="light" radius={radius.full} styles={{ root: { textTransform: 'none' } }}>
              Availability and Rates
            </Badge>
          </Group>

          {activeStep === 'search' ? <SearchStayStep onNext={() => setActiveStep('availability')} /> : null}
          {activeStep === 'availability' ? <AvailabilityStep onNext={() => setActiveStep('recommendation')} /> : null}
          {activeStep === 'recommendation' ? <RecommendationStep onNext={() => setActiveStep('rate')} /> : null}
          {activeStep === 'rate' ? <RateStep onNext={() => setActiveStep('corporate')} /> : null}
          {activeStep === 'corporate' ? <CorporateStep onNext={() => setActiveStep('create')} /> : null}
          {activeStep === 'create' ? <CreateReservationStep onCreate={() => setActiveStep('next')} /> : null}
          {activeStep === 'next' ? <NextActionStep /> : null}
        </Card>
      </Grid.Col>
    </Grid>
  );
}
