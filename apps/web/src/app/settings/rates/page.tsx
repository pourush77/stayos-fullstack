'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  BadgeIndianRupee,
  Baby,
  BedDouble,
  CheckCircle2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { useAuth } from '../../../features/auth/auth-context';
import {
  createRatePlan,
  getGuestPricingPolicy,
  getRatePlanRoomTypes,
  getRatePlans,
  removeRatePlanRoomType,
  updateRatePlan,
  upsertGuestPricingPolicy,
  upsertRatePlanRoomType,
  type ChildAgeBandDto,
  type ChildPricingMode,
  type CreateRatePlanPayload,
  type MealPlan,
  type RatePlanDto,
  type RatePlanRoomTypeDto,
  type RatePlanStatus,
  type UpsertGuestPricingPolicyPayload,
} from '../../../features/rates/api/rates-api';
import { getPropertyRoomTypes, type InventoryRoomTypeDto } from '../../../lib/inventory-api';

type ChildAgeBand = {
  id: string;
  label: string;
  minAge: number;
  maxAge: number;
  pricingMode: ChildPricingMode;
  fixedAmount?: string;
  percentage?: string;
};

type RatePlanForm = {
  code: string;
  name: string;
  description: string;
  isDefault: boolean;
  status: RatePlanStatus;
  mealPlan: MealPlan;
  refundable: boolean;
};

type RoomPricingDraft = {
  baseOccupancy: number | string;
  baseRate: number | string;
  extraAdultCharge: number | string;
  extraChildCharge: number | string;
};

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
} as const;

const pricingModeOptions = [
  { value: 'FREE', label: 'Free' },
  { value: 'FIXED_PER_NIGHT', label: 'Fixed amount per night' },
  { value: 'PERCENT_OF_ROOM_RATE', label: '% of room rate' },
  { value: 'RATE_PLAN_EXTRA_CHILD', label: 'Use rate-plan extra child price' },
  { value: 'ADULT_PRICING', label: 'Use adult pricing' },
];

const mealPlanOptions = [
  { value: 'ROOM_ONLY', label: 'Room only' },
  { value: 'BREAKFAST', label: 'Breakfast included' },
  { value: 'HALF_BOARD', label: 'Half board' },
  { value: 'FULL_BOARD', label: 'Full board' },
];

const initialBands: ChildAgeBand[] = [
  {
    id: 'young-child',
    label: 'Young Child',
    minAge: 0,
    maxAge: 5,
    pricingMode: 'FREE',
  },
  {
    id: 'child',
    label: 'Child',
    minAge: 6,
    maxAge: 11,
    pricingMode: 'RATE_PLAN_EXTRA_CHILD',
  },
  {
    id: 'older-child',
    label: 'Older Child',
    minAge: 12,
    maxAge: 17,
    pricingMode: 'ADULT_PRICING',
  },
];

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function emptyRatePlanForm(): RatePlanForm {
  return {
    code: '',
    name: '',
    description: '',
    isDefault: false,
    status: 'ACTIVE',
    mealPlan: 'ROOM_ONLY',
    refundable: true,
  };
}

function pricingSummary(band: ChildAgeBand) {
  switch (band.pricingMode) {
    case 'FREE':
      return 'Free';
    case 'FIXED_PER_NIGHT':
      return `₹${band.fixedAmount ?? '0'} / child / night`;
    case 'PERCENT_OF_ROOM_RATE':
      return `${band.percentage ?? '0'}% of room rate`;
    case 'RATE_PLAN_EXTRA_CHILD':
      return 'Use rate-plan extra child price';
    case 'ADULT_PRICING':
      return 'Use adult pricing';
    default:
      return '';
  }
}

function mapApiBand(band: ChildAgeBandDto): ChildAgeBand {
  return {
    id: band.id ?? `${band.minAge}-${band.maxAge}`,
    label: band.label,
    minAge: band.minAge,
    maxAge: band.maxAge,
    pricingMode: band.pricingMode,
    fixedAmount: band.fixedAmount ?? undefined,
    percentage: band.percentage ?? undefined,
  };
}

function money(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);

  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number.isFinite(parsed) ? parsed : 0);
}

function decimal(value: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : '0.00';
}

function ratePlanSummary(plan: RatePlanDto) {
  const meal =
    mealPlanOptions.find((option) => option.value === plan.mealPlan)?.label ?? plan.mealPlan;

  return `${meal} · ${plan.refundable ? 'Refundable' : 'Non-refundable'}`;
}

export default function RatesSettingsPage() {
  const auth = useAuth();
  const propertyId = auth.user?.propertyId ?? '';
  const canManage = hasPermission(auth.user?.permissions, 'settings.manage');

  const [activeTab, setActiveTab] = useState<string | null>('plans');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [plans, setPlans] = useState<RatePlanDto[]>([]);
  const [roomTypes, setRoomTypes] = useState<InventoryRoomTypeDto[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planPricing, setPlanPricing] = useState<RatePlanRoomTypeDto[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, RoomPricingDraft>>({});
  const [savingRoomTypeId, setSavingRoomTypeId] = useState<string | null>(null);
  const [removePricingCandidate, setRemovePricingCandidate] = useState<InventoryRoomTypeDto | null>(
    null,
  );

  const [planEditorOpened, setPlanEditorOpened] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RatePlanDto | null>(null);
  const [planForm, setPlanForm] = useState<RatePlanForm>(emptyRatePlanForm);
  const [savingPlan, setSavingPlan] = useState(false);

  const [ageBasedPricingEnabled, setAgeBasedPricingEnabled] = useState(true);
  const [maximumChildAge, setMaximumChildAge] = useState(17);
  const [bands, setBands] = useState<ChildAgeBand[]>(initialBands);
  const [savingGuestPricing, setSavingGuestPricing] = useState(false);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;

  useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      setError('No property is assigned to the current user.');
      return;
    }

    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError('');

        const [ratePlans, propertyRoomTypes, guestPricing] = await Promise.all([
          getRatePlans(propertyId, controller.signal),
          getPropertyRoomTypes(propertyId, controller.signal),
          getGuestPricingPolicy(propertyId, controller.signal),
        ]);

        if (controller.signal.aborted) return;

        setPlans(ratePlans);
        setRoomTypes(propertyRoomTypes.filter((roomType) => roomType.status === 'ACTIVE'));

        const defaultPlan =
          ratePlans.find((plan) => plan.isDefault && plan.status === 'ACTIVE') ??
          ratePlans.find((plan) => plan.status === 'ACTIVE') ??
          ratePlans[0];

        setSelectedPlanId(defaultPlan?.id ?? '');

        if (guestPricing) {
          setAgeBasedPricingEnabled(guestPricing.policy.ageBasedChildPricingEnabled);
          setMaximumChildAge(guestPricing.policy.maximumChildAge);
          setBands(
            guestPricing.childAgeBands
              .slice()
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map(mapApiBand),
          );
        }
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to load rate settings.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId || !selectedPlanId) {
      setPlanPricing([]);
      setPricingDrafts({});
      return;
    }

    const controller = new AbortController();

    async function loadPricing() {
      try {
        setPricingLoading(true);

        const pricing = await getRatePlanRoomTypes(propertyId, selectedPlanId, controller.signal);

        if (controller.signal.aborted) return;

        setPlanPricing(pricing);

        const drafts: Record<string, RoomPricingDraft> = {};

        for (const roomType of roomTypes) {
          const current = pricing.find((item) => item.roomTypeId === roomType.id);

          drafts[roomType.id] = current
            ? {
                baseOccupancy: current.baseOccupancy,
                baseRate: Number(current.baseRate),
                extraAdultCharge: Number(current.extraAdultCharge),
                extraChildCharge: Number(current.extraChildCharge),
              }
            : {
                baseOccupancy: roomType.baseOccupancy,
                baseRate: '',
                extraAdultCharge: 0,
                extraChildCharge: 0,
              };
        }

        setPricingDrafts(drafts);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }

        showToast({
          color: 'red',
          title: 'Could not load room pricing',
          message: loadError instanceof Error ? loadError.message : 'Please try again.',
        });
      } finally {
        if (!controller.signal.aborted) setPricingLoading(false);
      }
    }

    void loadPricing();

    return () => controller.abort();
  }, [propertyId, selectedPlanId, roomTypes]);

  const sortedBands = useMemo(() => [...bands].sort((a, b) => a.minAge - b.minAge), [bands]);

  const planFormError = useMemo(() => {
    if (!planForm.name.trim()) return 'Enter a rate plan name.';

    if (!editingPlan && !/^[A-Z0-9_-]+$/.test(planForm.code.trim())) {
      return 'Code must use uppercase letters, numbers, - or _.';
    }

    return '';
  }, [editingPlan, planForm.code, planForm.name]);

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanForm(emptyRatePlanForm());
    setPlanEditorOpened(true);
  }

  function openEditPlan(plan: RatePlanDto) {
    setEditingPlan(plan);
    setPlanForm({
      code: plan.code,
      name: plan.name,
      description: plan.description ?? '',
      isDefault: plan.isDefault,
      status: plan.status,
      mealPlan: plan.mealPlan,
      refundable: plan.refundable,
    });
    setPlanEditorOpened(true);
  }

  function closePlanEditor() {
    if (savingPlan) return;
    setPlanEditorOpened(false);
  }

  async function savePlan() {
    if (!propertyId || planFormError || !canManage) return;

    setSavingPlan(true);

    try {
      if (editingPlan) {
        const updated = await updateRatePlan(propertyId, editingPlan.id, {
          name: planForm.name.trim(),
          description: planForm.description.trim() || null,
          isDefault: planForm.isDefault,
          status: planForm.status,
          mealPlan: planForm.mealPlan,
          refundable: planForm.refundable,
        });

        setPlans((current) => current.map((plan) => (plan.id === updated.id ? updated : plan)));

        showToast({
          color: 'green',
          title: 'Rate plan saved',
          message: `${updated.name} is ready to use with its configured room prices.`,
        });
      } else {
        const payload: CreateRatePlanPayload = {
          code: planForm.code.trim(),
          name: planForm.name.trim(),
          description: planForm.description.trim() || null,
          isDefault: planForm.isDefault,
          status: planForm.status,
          mealPlan: planForm.mealPlan,
          refundable: planForm.refundable,
        };

        const created = await createRatePlan(propertyId, payload);

        setPlans((current) => [...current, created]);
        setSelectedPlanId(created.id);

        showToast({
          color: 'green',
          title: 'Rate plan created',
          message: 'Next, add prices for the room types this plan should sell.',
        });
      }

      setPlanEditorOpened(false);
    } catch (saveError) {
      showToast({
        color: 'red',
        title: 'Could not save rate plan',
        message:
          saveError instanceof Error
            ? saveError.message
            : 'Please check the details and try again.',
      });
    } finally {
      setSavingPlan(false);
    }
  }

  function setPricingDraft(roomTypeId: string, changes: Partial<RoomPricingDraft>) {
    setPricingDrafts((current) => ({
      ...current,
      [roomTypeId]: {
        ...(current[roomTypeId] ?? {
          baseOccupancy: 1,
          baseRate: '',
          extraAdultCharge: 0,
          extraChildCharge: 0,
        }),
        ...changes,
      },
    }));
  }

  async function saveRoomPricing(roomType: InventoryRoomTypeDto) {
    if (!propertyId || !selectedPlanId || !canManage) return;

    const draft = pricingDrafts[roomType.id];

    if (!draft) return;

    const baseOccupancy = Number(draft.baseOccupancy);
    const baseRate = Number(draft.baseRate);
    const extraAdultCharge = Number(draft.extraAdultCharge || 0);
    const extraChildCharge = Number(draft.extraChildCharge || 0);

    if (
      !Number.isInteger(baseOccupancy) ||
      baseOccupancy < 1 ||
      baseOccupancy > roomType.maxOccupancy
    ) {
      showToast({
        color: 'red',
        title: 'Check base occupancy',
        message: `Enter a whole number from 1 to ${roomType.maxOccupancy} for ${roomType.name}.`,
      });
      return;
    }

    if (
      !Number.isFinite(baseRate) ||
      baseRate < 0 ||
      !Number.isFinite(extraAdultCharge) ||
      extraAdultCharge < 0 ||
      !Number.isFinite(extraChildCharge) ||
      extraChildCharge < 0
    ) {
      showToast({
        color: 'red',
        title: 'Check pricing',
        message: 'Room prices and extra-person charges cannot be negative.',
      });
      return;
    }

    setSavingRoomTypeId(roomType.id);

    try {
      const updated = await upsertRatePlanRoomType(propertyId, selectedPlanId, {
        roomTypeId: roomType.id,
        baseOccupancy,
        baseRate: decimal(baseRate),
        extraAdultCharge: decimal(extraAdultCharge),
        extraChildCharge: decimal(extraChildCharge),
      });

      setPlanPricing((current) => {
        const exists = current.some((item) => item.roomTypeId === roomType.id);

        return exists
          ? current.map((item) => (item.roomTypeId === roomType.id ? updated : item))
          : [...current, updated];
      });

      showToast({
        color: 'green',
        title: `${roomType.name} pricing saved`,
        message: `${selectedPlan?.name ?? 'This rate plan'} can now price this room type.`,
      });
    } catch (saveError) {
      showToast({
        color: 'red',
        title: 'Could not save room pricing',
        message: saveError instanceof Error ? saveError.message : 'Please try again.',
      });
    } finally {
      setSavingRoomTypeId(null);
    }
  }

  async function removeRoomPricing(roomType: InventoryRoomTypeDto) {
    if (!propertyId || !selectedPlanId || !canManage) return;

    setSavingRoomTypeId(roomType.id);

    try {
      await removeRatePlanRoomType(propertyId, selectedPlanId, roomType.id);

      setPlanPricing((current) => current.filter((item) => item.roomTypeId !== roomType.id));

      setPricingDraft(roomType.id, {
        baseOccupancy: roomType.baseOccupancy,
        baseRate: '',
        extraAdultCharge: 0,
        extraChildCharge: 0,
      });

      showToast({
        color: 'green',
        title: `${roomType.name} removed`,
        message: 'This rate plan will no longer sell that room type.',
      });
    } catch (removeError) {
      showToast({
        color: 'red',
        title: 'Could not remove room pricing',
        message: removeError instanceof Error ? removeError.message : 'Please try again.',
      });
    } finally {
      setSavingRoomTypeId(null);
    }
  }

  function updateBand(id: string, changes: Partial<ChildAgeBand>) {
    setBands((currentBands) =>
      currentBands.map((band) => (band.id === id ? { ...band, ...changes } : band)),
    );
  }

  function handlePricingModeChange(id: string, value: string | null) {
    if (!value) return;

    const pricingMode = value as ChildPricingMode;

    setBands((currentBands) =>
      currentBands.map((band) => {
        if (band.id !== id) return band;

        return {
          ...band,
          pricingMode,
          fixedAmount: pricingMode === 'FIXED_PER_NIGHT' ? (band.fixedAmount ?? '0.00') : undefined,
          percentage: pricingMode === 'PERCENT_OF_ROOM_RATE' ? (band.percentage ?? '0') : undefined,
        };
      }),
    );
  }

  function addAgeBand() {
    const lastBand = sortedBands[sortedBands.length - 1];
    const minAge = lastBand ? lastBand.maxAge + 1 : 0;

    setBands((currentBands) => [
      ...currentBands,
      {
        id: `new-${Date.now()}`,
        label: 'New age band',
        minAge,
        maxAge: Math.max(minAge, maximumChildAge),
        pricingMode: 'RATE_PLAN_EXTRA_CHILD',
      },
    ]);
  }

  function removeAgeBand(id: string) {
    setBands((currentBands) => currentBands.filter((band) => band.id !== id));
  }

  function validateGuestPricing() {
    if (!Number.isInteger(maximumChildAge) || maximumChildAge < 0) {
      return 'Maximum child age must be a whole non-negative number.';
    }

    if (!ageBasedPricingEnabled) return '';

    if (sortedBands.length === 0) {
      return 'Add at least one child age rule.';
    }

    if (sortedBands[0].minAge !== 0) {
      return 'Child age rules must start from age 0.';
    }

    for (let index = 0; index < sortedBands.length; index += 1) {
      const band = sortedBands[index];

      if (!band.label.trim()) return 'Every child age rule needs a label.';
      if (!Number.isInteger(band.minAge) || !Number.isInteger(band.maxAge)) {
        return 'Child ages must be whole numbers.';
      }
      if (band.minAge < 0 || band.maxAge < band.minAge) {
        return `Check the age range for "${band.label}".`;
      }
      if (band.maxAge > maximumChildAge) {
        return `"${band.label}" exceeds the maximum child age.`;
      }

      if (index > 0) {
        const previous = sortedBands[index - 1];

        if (band.minAge !== previous.maxAge + 1) {
          return 'Child age rules must be continuous without gaps or overlaps.';
        }
      }

      if (band.pricingMode === 'FIXED_PER_NIGHT' && !band.fixedAmount?.trim()) {
        return `"${band.label}" needs a fixed amount.`;
      }

      if (band.pricingMode === 'PERCENT_OF_ROOM_RATE' && !band.percentage?.trim()) {
        return `"${band.label}" needs a percentage.`;
      }
    }

    if (sortedBands[sortedBands.length - 1].maxAge !== maximumChildAge) {
      return `Child age rules must cover every age through ${maximumChildAge}.`;
    }

    return '';
  }

  async function saveGuestPricing() {
    if (!propertyId || !canManage) return;

    const validationError = validateGuestPricing();

    if (validationError) {
      showToast({
        color: 'red',
        title: 'Check child pricing',
        message: validationError,
      });
      return;
    }

    const payload: UpsertGuestPricingPolicyPayload = {
      ageBasedChildPricingEnabled: ageBasedPricingEnabled,
      maximumChildAge,
      isActive: true,
      childAgeBands: ageBasedPricingEnabled
        ? sortedBands.map((band, index) => ({
            label: band.label.trim(),
            minAge: band.minAge,
            maxAge: band.maxAge,
            pricingMode: band.pricingMode,
            ...(band.pricingMode === 'FIXED_PER_NIGHT'
              ? { fixedAmount: band.fixedAmount ?? '0.00' }
              : {}),
            ...(band.pricingMode === 'PERCENT_OF_ROOM_RATE'
              ? { percentage: band.percentage ?? '0' }
              : {}),
            displayOrder: index,
            isActive: true,
          }))
        : [],
    };

    setSavingGuestPricing(true);

    try {
      const response = await upsertGuestPricingPolicy(propertyId, payload);

      setAgeBasedPricingEnabled(response.policy.ageBasedChildPricingEnabled);
      setMaximumChildAge(response.policy.maximumChildAge);
      setBands(
        response.childAgeBands
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(mapApiBand),
      );

      showToast({
        color: 'green',
        title: 'Guest pricing saved',
        message: 'StayOS will use these child-age rules when a booking is priced.',
      });
    } catch (saveError) {
      showToast({
        color: 'red',
        title: 'Could not save guest pricing',
        message: saveError instanceof Error ? saveError.message : 'Please try again.',
      });
    } finally {
      setSavingGuestPricing(false);
    }
  }

  if (loading) {
    return (
      <Stack align="center" justify="center" gap="md" style={{ minHeight: 320 }}>
        <Loader size="md" />
        <Text c="#64748b">Loading rates and guest pricing...</Text>
      </Stack>
    );
  }

  return (
    <>
      <Stack gap={spacing[4]} data-testid="rates-settings-page">
        <Group justify="space-between" align="flex-start" gap={spacing[3]} wrap="wrap">
          <Box>
            <Group gap={10}>
              <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={42}>
                <BadgeIndianRupee size={21} />
              </ThemeIcon>

              <Box>
                <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
                  Rates & Guest Pricing
                </Title>

                <Text c="#64748b" mt={4} size="sm">
                  Set the room prices StayOS sells and how guest occupancy changes the price.
                </Text>
              </Box>
            </Group>
          </Box>
        </Group>

        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="plans" leftSection={<BedDouble size={15} />}>
              Rate plans
            </Tabs.Tab>
            <Tabs.Tab value="guests" leftSection={<Baby size={15} />}>
              Guest & child pricing
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="plans" pt={spacing[4]}>
            <Stack gap={spacing[4]}>
              <Group justify="space-between" align="flex-end" gap={spacing[3]} wrap="wrap">
                <Box>
                  <Text c="#101828" fw={850} size="lg">
                    Rate plans
                  </Text>
                  <Text c="#64748b" size="sm" mt={3}>
                    Create sellable plans such as BAR, breakfast-inclusive or non-refundable rates.
                  </Text>
                </Box>

                {canManage ? (
                  <Button
                    color="stayosBrand"
                    leftSection={<Plus size={16} />}
                    onClick={openCreatePlan}
                  >
                    Add rate plan
                  </Button>
                ) : null}
              </Group>

              {plans.length === 0 ? (
                <Paper radius={radius.lg} p={28} style={cardStyle}>
                  <Stack align="center" ta="center" gap={10}>
                    <ThemeIcon color="stayosBrand" size={48} radius="xl" variant="light">
                      <BedDouble size={22} />
                    </ThemeIcon>

                    <Text c="#101828" fw={800}>
                      No rate plans yet
                    </Text>

                    <Text c="#64748b" size="sm" maw={520}>
                      Create a default plan, then add a base room price for every room type you want
                      to sell.
                    </Text>

                    {canManage ? (
                      <Button onClick={openCreatePlan}>Create first rate plan</Button>
                    ) : null}
                  </Stack>
                </Paper>
              ) : (
                <>
                  <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
                    {plans.map((plan) => (
                      <Card
                        key={plan.id}
                        radius={radius.lg}
                        p={18}
                        style={{
                          ...cardStyle,
                          borderColor:
                            selectedPlanId === plan.id ? '#c4b5fd' : 'rgba(226, 232, 240, 0.9)',
                        }}
                      >
                        <Stack gap={12}>
                          <Group
                            justify="space-between"
                            align="flex-start"
                            gap={spacing[2]}
                            wrap="wrap"
                          >
                            <Box>
                              <Group gap={7}>
                                <Text c="#101828" fw={850}>
                                  {plan.name}
                                </Text>

                                {plan.isDefault ? (
                                  <Badge color="violet" variant="light">
                                    Default
                                  </Badge>
                                ) : null}

                                <Badge
                                  color={plan.status === 'ACTIVE' ? 'green' : 'gray'}
                                  variant="light"
                                >
                                  {plan.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                </Badge>
                              </Group>

                              <Text c="#7c3aed" size="xs" fw={800} mt={4}>
                                {plan.code}
                              </Text>
                            </Box>

                            {canManage ? (
                              <Button
                                size="compact-sm"
                                variant="subtle"
                                color="gray"
                                leftSection={<Pencil size={14} />}
                                onClick={() => openEditPlan(plan)}
                              >
                                Edit
                              </Button>
                            ) : null}
                          </Group>

                          <Text c="#64748b" size="sm">
                            {ratePlanSummary(plan)}
                          </Text>

                          {plan.description ? (
                            <Text c="#94a3b8" size="xs" lineClamp={2}>
                              {plan.description}
                            </Text>
                          ) : null}

                          <Button
                            variant={selectedPlanId === plan.id ? 'light' : 'subtle'}
                            onClick={() => setSelectedPlanId(plan.id)}
                          >
                            {selectedPlanId === plan.id
                              ? 'Pricing shown below'
                              : 'Manage room pricing'}
                          </Button>
                        </Stack>
                      </Card>
                    ))}
                  </SimpleGrid>

                  {selectedPlan ? (
                    <Card radius={radius.lg} p={20} style={cardStyle}>
                      <Stack gap={spacing[4]}>
                        <Group
                          justify="space-between"
                          align="flex-start"
                          gap={spacing[2]}
                          wrap="wrap"
                        >
                          <Box>
                            <Group gap={8}>
                              <Text c="#101828" fw={850} size="lg">
                                Room pricing · {selectedPlan.name}
                              </Text>

                              {selectedPlan.isDefault ? (
                                <Badge color="violet" variant="light">
                                  Default plan
                                </Badge>
                              ) : null}
                            </Group>

                            <Text c="#64748b" size="sm" mt={4}>
                              The base rate covers the base occupancy. Extra adult and child charges
                              apply above it.
                            </Text>
                          </Box>
                        </Group>

                        <Alert color="blue" variant="light">
                          Save each room type separately. A room type without pricing is not sold
                          through this rate plan.
                        </Alert>

                        {pricingLoading ? (
                          <Group justify="center" py={24}>
                            <Loader size="sm" />
                            <Text c="#64748b" size="sm">
                              Loading room pricing...
                            </Text>
                          </Group>
                        ) : roomTypes.length === 0 ? (
                          <Alert color="yellow">
                            No active room types are available. Create room types before adding
                            rate-plan pricing.
                          </Alert>
                        ) : (
                          <Stack gap={12}>
                            {roomTypes.map((roomType) => {
                              const current = planPricing.find(
                                (item) => item.roomTypeId === roomType.id,
                              );
                              const draft = pricingDrafts[roomType.id];

                              if (!draft) return null;

                              return (
                                <Card
                                  key={roomType.id}
                                  radius={radius.md}
                                  p={16}
                                  style={{
                                    background: '#fbfcfe',
                                    border: '1px solid #e2e8f0',
                                  }}
                                >
                                  <Stack gap={14}>
                                    <Group
                                      justify="space-between"
                                      align="flex-start"
                                      gap={spacing[2]}
                                      wrap="wrap"
                                    >
                                      <Box>
                                        <Group gap={8}>
                                          <Text c="#101828" fw={800}>
                                            {roomType.name}
                                          </Text>

                                          <Badge variant="light" color="gray">
                                            {roomType.code}
                                          </Badge>

                                          <Badge
                                            variant="light"
                                            color={current ? 'green' : 'yellow'}
                                          >
                                            {current ? 'Priced' : 'Not priced'}
                                          </Badge>
                                        </Group>

                                        <Text c="#64748b" size="xs" mt={4}>
                                          Normal occupancy {roomType.baseOccupancy} · Max{' '}
                                          {roomType.maxOccupancy} guests
                                        </Text>
                                      </Box>

                                      {current && canManage ? (
                                        <Button
                                          color="red"
                                          variant="subtle"
                                          size="compact-sm"
                                          leftSection={<Trash2 size={14} />}
                                          loading={savingRoomTypeId === roomType.id}
                                          onClick={() => setRemovePricingCandidate(roomType)}
                                        >
                                          Remove
                                        </Button>
                                      ) : null}
                                    </Group>

                                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                                      <NumberInput
                                        label="Base occupancy"
                                        description="Guests included in the base rate."
                                        min={1}
                                        max={roomType.maxOccupancy}
                                        allowDecimal={false}
                                        disabled={!canManage}
                                        value={draft.baseOccupancy}
                                        onChange={(value) =>
                                          setPricingDraft(roomType.id, {
                                            baseOccupancy: value,
                                          })
                                        }
                                      />

                                      <NumberInput
                                        label="Base rate"
                                        description="Per room / night."
                                        min={0}
                                        prefix="₹ "
                                        thousandSeparator=","
                                        disabled={!canManage}
                                        value={draft.baseRate}
                                        onChange={(value) =>
                                          setPricingDraft(roomType.id, {
                                            baseRate: value,
                                          })
                                        }
                                      />

                                      <NumberInput
                                        label="Extra adult"
                                        description="Per extra adult / night."
                                        min={0}
                                        prefix="₹ "
                                        thousandSeparator=","
                                        disabled={!canManage}
                                        value={draft.extraAdultCharge}
                                        onChange={(value) =>
                                          setPricingDraft(roomType.id, {
                                            extraAdultCharge: value,
                                          })
                                        }
                                      />

                                      <NumberInput
                                        label="Extra child"
                                        description="Rate-plan child amount / night."
                                        min={0}
                                        prefix="₹ "
                                        thousandSeparator=","
                                        disabled={!canManage}
                                        value={draft.extraChildCharge}
                                        onChange={(value) =>
                                          setPricingDraft(roomType.id, {
                                            extraChildCharge: value,
                                          })
                                        }
                                      />
                                    </SimpleGrid>

                                    <Group
                                      justify="space-between"
                                      align="center"
                                      gap={spacing[3]}
                                      wrap="wrap"
                                    >
                                      <Text c="#64748b" size="xs">
                                        {current
                                          ? `Current base rate ${money(
                                              current.baseRate,
                                            )} for ${current.baseOccupancy} guest${
                                              current.baseOccupancy === 1 ? '' : 's'
                                            }.`
                                          : 'Enter a base rate, then save to make this room type available on the plan.'}
                                      </Text>

                                      {canManage ? (
                                        <Button
                                          color="stayosBrand"
                                          leftSection={<Save size={14} />}
                                          loading={savingRoomTypeId === roomType.id}
                                          onClick={() => void saveRoomPricing(roomType)}
                                        >
                                          {current ? 'Save pricing' : 'Add pricing'}
                                        </Button>
                                      ) : null}
                                    </Group>
                                  </Stack>
                                </Card>
                              );
                            })}
                          </Stack>
                        )}
                      </Stack>
                    </Card>
                  ) : null}
                </>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="guests" pt={spacing[4]}>
            <Stack gap={spacing[4]}>
              <Card radius={radius.lg} p={24} style={cardStyle}>
                <Group justify="space-between" align="center">
                  <Group gap={12}>
                    <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={40}>
                      <Baby size={20} />
                    </ThemeIcon>

                    <Box>
                      <Text c="#101828" fw={850}>
                        Child pricing
                      </Text>

                      <Text c="#64748b" size="sm" mt={2}>
                        Apply different pricing based on the child&apos;s age.
                      </Text>
                    </Box>
                  </Group>

                  <Switch
                    checked={ageBasedPricingEnabled}
                    disabled={!canManage}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setAgeBasedPricingEnabled(checked);
                    }}
                    size="md"
                    label="Age-based pricing"
                  />
                </Group>

                <Divider my={22} />

                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <Box>
                    <Text c="#344054" fw={700} size="sm">
                      Maximum child age
                    </Text>

                    <Text c="#667085" size="xs" mt={3} mb={8}>
                      Guests above this age are treated as adults.
                    </Text>

                    <NumberInput
                      value={maximumChildAge}
                      disabled={!canManage}
                      onChange={(value) => {
                        if (typeof value === 'number') {
                          setMaximumChildAge(value);
                        }
                      }}
                      min={0}
                      max={25}
                      allowDecimal={false}
                      suffix=" years"
                    />
                  </Box>

                  <Card
                    radius={radius.md}
                    p={16}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <Group gap={8}>
                      <Sparkles size={16} color="#64748b" />
                      <Text c="#344054" fw={700} size="sm">
                        Easy option
                      </Text>
                    </Group>

                    <Text c="#64748b" size="sm" mt={8}>
                      Choose “Use rate-plan extra child price” when each rate plan should control
                      the child amount. This keeps BAR, breakfast and promotional plans flexible.
                    </Text>
                  </Card>
                </SimpleGrid>
              </Card>

              <Card radius={radius.lg} p={24} style={cardStyle}>
                <Group justify="space-between" mb={18}>
                  <Box>
                    <Text c="#101828" fw={850}>
                      Child age rules
                    </Text>
                    <Text c="#64748b" size="sm" mt={3}>
                      Keep age ranges continuous so every child age has exactly one rule.
                    </Text>
                  </Box>

                  <Button
                    variant="light"
                    leftSection={<Plus size={15} />}
                    disabled={!canManage || !ageBasedPricingEnabled}
                    onClick={addAgeBand}
                  >
                    Add age band
                  </Button>
                </Group>

                {!ageBasedPricingEnabled ? (
                  <Alert color="blue">Child age rules are currently disabled.</Alert>
                ) : (
                  <Stack gap={12}>
                    {bands.map((band) => (
                      <Card
                        key={band.id}
                        radius={radius.md}
                        p={18}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <Stack gap={14}>
                          <Group
                            justify="space-between"
                            align="flex-start"
                            gap={spacing[2]}
                            wrap="wrap"
                          >
                            <Box>
                              <Group gap={8}>
                                <Text c="#101828" fw={800} size="sm">
                                  Age {band.minAge}–{band.maxAge}
                                </Text>
                                <Badge variant="light" color="gray">
                                  {pricingSummary(band)}
                                </Badge>
                              </Group>
                              <Text c="#94a3b8" size="xs" mt={4}>
                                Applied automatically during booking
                              </Text>
                            </Box>

                            <Button
                              variant="subtle"
                              color="red"
                              size="compact-sm"
                              disabled={!canManage}
                              leftSection={<Trash2 size={14} />}
                              onClick={() => removeAgeBand(band.id)}
                            >
                              Remove
                            </Button>
                          </Group>

                          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={spacing[3]}>
                            <TextInput
                              label="Label"
                              disabled={!canManage}
                              value={band.label}
                              onChange={(event) => {
                                const value = event.currentTarget.value;
                                updateBand(band.id, { label: value });
                              }}
                            />

                            <NumberInput
                              label="From age"
                              value={band.minAge}
                              disabled={!canManage}
                              min={0}
                              allowDecimal={false}
                              onChange={(value) => {
                                if (typeof value === 'number') {
                                  updateBand(band.id, { minAge: value });
                                }
                              }}
                            />

                            <NumberInput
                              label="To age"
                              value={band.maxAge}
                              disabled={!canManage}
                              min={0}
                              allowDecimal={false}
                              onChange={(value) => {
                                if (typeof value === 'number') {
                                  updateBand(band.id, { maxAge: value });
                                }
                              }}
                            />

                            <Select
                              label="Pricing"
                              value={band.pricingMode}
                              disabled={!canManage}
                              data={pricingModeOptions}
                              allowDeselect={false}
                              onChange={(value) => handlePricingModeChange(band.id, value)}
                            />
                          </SimpleGrid>

                          {band.pricingMode === 'FIXED_PER_NIGHT' ? (
                            <NumberInput
                              maw={280}
                              label="Amount per child / night"
                              min={0}
                              prefix="₹ "
                              thousandSeparator=","
                              disabled={!canManage}
                              value={Number(band.fixedAmount ?? 0)}
                              onChange={(value) =>
                                updateBand(band.id, {
                                  fixedAmount: decimal(typeof value === 'number' ? value : 0),
                                })
                              }
                            />
                          ) : null}

                          {band.pricingMode === 'PERCENT_OF_ROOM_RATE' ? (
                            <NumberInput
                              maw={280}
                              label="% of room rate"
                              min={0}
                              max={100}
                              suffix=" %"
                              disabled={!canManage}
                              value={Number(band.percentage ?? 0)}
                              onChange={(value) =>
                                updateBand(band.id, {
                                  percentage: String(typeof value === 'number' ? value : 0),
                                })
                              }
                            />
                          ) : null}
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                )}

                <Group justify="flex-end" mt={20}>
                  <Button
                    color="stayosBrand"
                    leftSection={<CheckCircle2 size={15} />}
                    disabled={!canManage}
                    loading={savingGuestPricing}
                    onClick={() => void saveGuestPricing()}
                  >
                    Save guest pricing
                  </Button>
                </Group>
              </Card>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      <Modal
        centered
        opened={Boolean(removePricingCandidate)}
        onClose={() => {
          if (!savingRoomTypeId) setRemovePricingCandidate(null);
        }}
        radius={radius.lg}
        size="sm"
        title="Remove room type from this rate plan?"
        closeOnClickOutside={!savingRoomTypeId}
        closeOnEscape={!savingRoomTypeId}
        withCloseButton={!savingRoomTypeId}
      >
        <Stack gap={spacing[3]}>
          <Text c="#475569" size="sm">
            {removePricingCandidate ? (
              <>
                <Text component="span" inherit fw={800} c="#101828">
                  {removePricingCandidate.name}
                </Text>{' '}
                will no longer be sellable through {selectedPlan?.name ?? 'this rate plan'}.
              </>
            ) : null}
          </Text>
          <Alert color="yellow" variant="light">
            This removes the configured base and extra-guest pricing for this room type. It does not
            delete the room type itself.
          </Alert>
          <Group justify="flex-end" gap={8} wrap="wrap">
            <Button
              variant="subtle"
              color="gray"
              disabled={Boolean(savingRoomTypeId)}
              onClick={() => setRemovePricingCandidate(null)}
            >
              Keep pricing
            </Button>
            <Button
              color="red"
              leftSection={<Trash2 size={14} />}
              loading={Boolean(
                removePricingCandidate && savingRoomTypeId === removePricingCandidate.id,
              )}
              onClick={() => {
                if (!removePricingCandidate) return;
                void removeRoomPricing(removePricingCandidate).then(() =>
                  setRemovePricingCandidate(null),
                );
              }}
            >
              Remove pricing
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        centered
        opened={planEditorOpened}
        onClose={closePlanEditor}
        radius={radius.lg}
        size="lg"
        title={
          <Box>
            <Text c="#101828" fw={850} size="lg">
              {editingPlan ? 'Edit rate plan' : 'Add rate plan'}
            </Text>
            <Text c="#64748b" size="sm" mt={2}>
              Set the commercial rules first. Room prices are configured after the plan is saved.
            </Text>
          </Box>
        }
      >
        <Stack gap={spacing[4]}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              autoFocus
              label="Plan name"
              placeholder="Best Available Rate"
              disabled={savingPlan}
              value={planForm.name}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setPlanForm((current) => ({ ...current, name: value }));
              }}
            />

            <TextInput
              label="Code"
              placeholder="BAR"
              description={
                editingPlan
                  ? 'The code cannot be changed after creation.'
                  : 'Short uppercase code used internally.'
              }
              disabled={savingPlan || Boolean(editingPlan)}
              value={planForm.code}
              onChange={(event) => {
                const value = event.currentTarget.value.toUpperCase();
                setPlanForm((current) => ({ ...current, code: value }));
              }}
            />
          </SimpleGrid>

          <Textarea
            label="Description"
            placeholder="Flexible everyday rate"
            disabled={savingPlan}
            minRows={2}
            value={planForm.description}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setPlanForm((current) => ({
                ...current,
                description: value,
              }));
            }}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Meal plan"
              disabled={savingPlan}
              data={mealPlanOptions}
              value={planForm.mealPlan}
              onChange={(value) =>
                setPlanForm((current) => ({
                  ...current,
                  mealPlan: (value ?? 'ROOM_ONLY') as MealPlan,
                }))
              }
            />

            <Select
              label="Status"
              disabled={savingPlan}
              data={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
              value={planForm.status}
              onChange={(value) =>
                setPlanForm((current) => ({
                  ...current,
                  status: (value ?? 'ACTIVE') as RatePlanStatus,
                }))
              }
            />
          </SimpleGrid>

          <Switch
            checked={planForm.refundable}
            disabled={savingPlan}
            label="Refundable"
            description="Turn this off for a non-refundable rate plan."
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              setPlanForm((current) => ({
                ...current,
                refundable: checked,
              }));
            }}
          />

          <Switch
            checked={planForm.isDefault}
            disabled={savingPlan}
            label="Default rate plan"
            description="StayOS uses the default active plan when a booking does not explicitly choose another plan."
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              setPlanForm((current) => ({
                ...current,
                isDefault: checked,
              }));
            }}
          />

          {planFormError ? (
            <Alert color="red" variant="light">
              {planFormError}
            </Alert>
          ) : (
            <Alert color="blue" variant="light">
              After saving, StayOS will guide you to add a base price for each room type this plan
              should sell.
            </Alert>
          )}

          <Group justify="flex-end">
            <Button color="gray" variant="subtle" disabled={savingPlan} onClick={closePlanEditor}>
              Cancel
            </Button>

            <Button
              color="stayosBrand"
              leftSection={<Save size={15} />}
              disabled={Boolean(planFormError)}
              loading={savingPlan}
              onClick={() => void savePlan()}
            >
              {editingPlan ? 'Save changes' : 'Create rate plan'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
