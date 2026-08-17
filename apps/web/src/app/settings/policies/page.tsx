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
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  CalendarClock,
  ClipboardCheck,
  Clock3,
  DoorOpen,
  LogOut,
  Save,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { useAuth } from '../../../features/auth/auth-context';
import {
  getPropertyPolicies,
  upsertPropertyPolicy,
  type DepositPolicyMode,
  type PolicyChargeMode,
  type PropertyPolicyDto,
  type PropertyPolicyType,
  type UpsertPropertyPolicyPayload,
} from '../../../lib/guest-api';

const panelStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.95)',
  boxShadow: '0 8px 28px rgba(15,23,42,0.055)',
};

type PolicyFormState = {
  isActive: boolean;
  depositMode: DepositPolicyMode;
  depositValue: number | string;
  chargeMode: PolicyChargeMode;
  chargeValue: number | string;
  cancellationCutoffHours: number | string;
  graceMinutes: number | string;
};

type PolicyDefinition = {
  type: PropertyPolicyType;
  title: string;
  description: string;
  kind: 'deposit' | 'charge';
  allowFirstNight?: boolean;
  hasCancellationWindow?: boolean;
  hasGracePeriod?: boolean;
  icon: React.ReactNode;
};

const POLICY_DEFINITIONS: PolicyDefinition[] = [
  {
    type: 'INDIVIDUAL_DEPOSIT',
    title: 'Individual booking deposit',
    description: 'Set the advance normally required for a regular guest booking.',
    kind: 'deposit',
    icon: <UserRound size={19} />,
  },
  {
    type: 'GROUP_DEPOSIT',
    title: 'Group booking deposit',
    description: 'Set the advance normally required before a group booking is confirmed.',
    kind: 'deposit',
    icon: <UsersRound size={19} />,
  },
  {
    type: 'CANCELLATION',
    title: 'Cancellation',
    description: 'Set the free-cancellation window and the fee after that window closes.',
    kind: 'charge',
    allowFirstNight: true,
    hasCancellationWindow: true,
    icon: <CalendarClock size={19} />,
  },
  {
    type: 'NO_SHOW',
    title: 'No-show',
    description: 'Choose the fee when a guest does not arrive and the booking is marked no-show.',
    kind: 'charge',
    allowFirstNight: true,
    icon: <DoorOpen size={19} />,
  },
  {
    type: 'EARLY_CHECK_IN',
    title: 'Early check-in',
    description: 'Choose the fee staff can approve when a guest arrives before standard check-in.',
    kind: 'charge',
    hasGracePeriod: true,
    icon: <Clock3 size={19} />,
  },
  {
    type: 'LATE_CHECKOUT',
    title: 'Late checkout',
    description: 'Choose the fee staff can approve when a guest stays beyond standard check-out.',
    kind: 'charge',
    hasGracePeriod: true,
    icon: <LogOut size={19} />,
  },
];

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function policyFor(policies: PropertyPolicyDto[], type: PropertyPolicyType) {
  return policies.find((policy) => policy.policyType === type && policy.ratePlanId === null);
}

function starterForm(definition: PolicyDefinition): PolicyFormState {
  if (definition.kind === 'deposit') {
    return {
      isActive: true,
      depositMode: 'NONE',
      depositValue: '',
      chargeMode: 'NONE',
      chargeValue: '',
      cancellationCutoffHours: '',
      graceMinutes: '',
    };
  }

  if (definition.type === 'CANCELLATION') {
    return {
      isActive: true,
      depositMode: 'NONE',
      depositValue: '',
      chargeMode: 'FIRST_NIGHT',
      chargeValue: '',
      cancellationCutoffHours: 24,
      graceMinutes: '',
    };
  }

  if (definition.type === 'NO_SHOW') {
    return {
      isActive: true,
      depositMode: 'NONE',
      depositValue: '',
      chargeMode: 'FIRST_NIGHT',
      chargeValue: '',
      cancellationCutoffHours: '',
      graceMinutes: '',
    };
  }

  return {
    isActive: true,
    depositMode: 'NONE',
    depositValue: '',
    chargeMode: 'NONE',
    chargeValue: '',
    cancellationCutoffHours: '',
    graceMinutes: 60,
  };
}

function formFromPolicy(definition: PolicyDefinition, policy?: PropertyPolicyDto): PolicyFormState {
  if (!policy) return starterForm(definition);

  return {
    isActive: policy.isActive,
    depositMode: policy.depositMode ?? 'NONE',
    depositValue:
      policy.depositMode && policy.depositMode !== 'NONE' ? Number(policy.depositValue ?? 0) : '',
    chargeMode: policy.chargeMode ?? 'NONE',
    chargeValue:
      policy.chargeMode && !['NONE', 'FIRST_NIGHT'].includes(policy.chargeMode)
        ? Number(policy.chargeValue ?? 0)
        : '',
    cancellationCutoffHours: policy.cancellationCutoffHours ?? '',
    graceMinutes: policy.graceMinutes ?? '',
  };
}

function currency(value: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value ?? 0));
}

function summary(definition: PolicyDefinition, policy?: PropertyPolicyDto) {
  if (!policy) return 'Not configured yet';

  if (!policy.isActive) return 'Paused';

  if (definition.kind === 'deposit') {
    if (policy.depositMode === 'NONE') return 'No deposit required';

    if (policy.depositMode === 'PERCENTAGE') {
      return `${Number(policy.depositValue ?? 0)}% deposit`;
    }

    return `${currency(policy.depositValue)} deposit`;
  }

  const fee =
    policy.chargeMode === 'NONE'
      ? 'No fee'
      : policy.chargeMode === 'FIRST_NIGHT'
        ? "First night's room rate"
        : policy.chargeMode === 'PERCENTAGE'
          ? `${Number(policy.chargeValue ?? 0)}% fee`
          : `${currency(policy.chargeValue)} fee`;

  if (definition.hasCancellationWindow && policy.cancellationCutoffHours !== null) {
    return `Free until ${policy.cancellationCutoffHours} hours before arrival · ${fee} after`;
  }

  if (definition.hasGracePeriod && policy.graceMinutes !== null) {
    return `${policy.graceMinutes}-minute grace · ${fee}`;
  }

  return fee;
}

export default function StayPoliciesPage() {
  const auth = useAuth();
  const propertyId = auth.user?.propertyId ?? '';
  const canManage = hasPermission(auth.user?.permissions, 'settings.manage');

  const [policies, setPolicies] = useState<PropertyPolicyDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editingDefinition, setEditingDefinition] = useState<PolicyDefinition | null>(null);
  const [form, setForm] = useState<PolicyFormState>(starterForm(POLICY_DEFINITIONS[0]));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setLoadError('');

    void getPropertyPolicies(propertyId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setPolicies(data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'We could not load stay policies. Please try again.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [propertyId]);

  const validationError = useMemo(() => {
    if (!editingDefinition) return '';

    if (editingDefinition.kind === 'deposit') {
      if (form.depositMode === 'NONE') return '';

      const value = Number(form.depositValue);

      if (!Number.isFinite(value) || value <= 0) {
        return 'Enter a deposit greater than 0.';
      }

      if (form.depositMode === 'PERCENTAGE' && value > 100) {
        return 'Deposit percentage cannot be more than 100%.';
      }

      return '';
    }

    if (!editingDefinition.allowFirstNight && form.chargeMode === 'FIRST_NIGHT') {
      return 'First-night pricing is not available for this policy.';
    }

    if (form.chargeMode === 'PERCENTAGE' || form.chargeMode === 'FIXED_AMOUNT') {
      const value = Number(form.chargeValue);

      if (!Number.isFinite(value) || value <= 0) {
        return 'Enter a fee greater than 0.';
      }

      if (form.chargeMode === 'PERCENTAGE' && value > 100) {
        return 'Fee percentage cannot be more than 100%.';
      }
    }

    if (editingDefinition.hasCancellationWindow) {
      const value = Number(form.cancellationCutoffHours);

      if (form.cancellationCutoffHours === '' || !Number.isInteger(value) || value < 0) {
        return 'Enter the free-cancellation window in whole hours.';
      }
    }

    if (editingDefinition.hasGracePeriod) {
      const value = Number(form.graceMinutes);

      if (form.graceMinutes === '' || !Number.isInteger(value) || value < 0) {
        return 'Enter the grace period in whole minutes.';
      }
    }

    return '';
  }, [editingDefinition, form]);

  const openEditor = (definition: PolicyDefinition) => {
    const existing = policyFor(policies, definition.type);

    setEditingDefinition(definition);
    setForm(formFromPolicy(definition, existing));
  };

  const closeEditor = () => {
    if (saving) return;
    setEditingDefinition(null);
  };

  const savePolicy = async () => {
    if (!propertyId || !editingDefinition || !canManage || validationError) {
      return;
    }

    const payload: UpsertPropertyPolicyPayload = {
      isActive: form.isActive,
    };

    if (editingDefinition.kind === 'deposit') {
      payload.depositMode = form.depositMode;

      if (form.depositMode !== 'NONE') {
        payload.depositValue = Number(form.depositValue);
      }
    } else {
      payload.chargeMode = form.chargeMode;

      if (form.chargeMode === 'PERCENTAGE' || form.chargeMode === 'FIXED_AMOUNT') {
        payload.chargeValue = Number(form.chargeValue);
      }

      if (editingDefinition.hasCancellationWindow) {
        payload.cancellationCutoffHours = Number(form.cancellationCutoffHours);
      }

      if (editingDefinition.hasGracePeriod) {
        payload.graceMinutes = Number(form.graceMinutes);
      }
    }

    setSaving(true);

    try {
      const updated = await upsertPropertyPolicy(propertyId, editingDefinition.type, payload);

      setPolicies((current) => {
        const found = current.some(
          (policy) =>
            policy.policyType === updated.policyType && policy.ratePlanId === updated.ratePlanId,
        );

        if (!found) return [...current, updated];

        return current.map((policy) =>
          policy.policyType === updated.policyType && policy.ratePlanId === updated.ratePlanId
            ? updated
            : policy,
        );
      });

      showToast({
        color: 'green',
        title: `${editingDefinition.title} saved`,
        message: 'StayOS will use this property policy in the matching booking or Front Desk flow.',
      });

      setEditingDefinition(null);
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Could not save policy',
        message: error instanceof Error ? error.message : 'Please check the values and try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!hasPermission(auth.user?.permissions, 'settings.view')) {
    return (
      <Alert color="red" variant="light" radius={radius.lg}>
        You do not have permission to view stay policies.
      </Alert>
    );
  }

  return (
    <>
      <Stack gap={spacing[4]} data-testid="stay-policies-page">
        <Box>
          <Group gap={10}>
            <ClipboardCheck size={26} color="#7d4dd6" />

            <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
              Stay Policies
            </Title>
          </Group>

          <Text c="#64748b" mt={4} style={{ fontSize: 14 }}>
            Set the rules StayOS should follow for deposits, cancellations, arrivals and departures.
          </Text>
        </Box>

        <Alert color="blue" radius={radius.lg} icon={<ShieldCheck size={18} />} variant="light">
          <Text fw={700} size="sm">
            Staff still stays in control
          </Text>

          <Text size="sm" mt={2}>
            Early check-in and late checkout fees are not added just because the clock passes a
            certain time. StayOS shows the policy and the Front Desk explicitly approves the charge.
          </Text>
        </Alert>

        {loadError ? (
          <Alert color="red" radius={radius.lg} variant="light">
            {loadError}
          </Alert>
        ) : null}

        {isLoading ? (
          <Paper radius={radius.lg} p={28} style={panelStyle}>
            <Group justify="center" gap={10}>
              <Loader size="sm" color="stayosBrand" />
              <Text c="#64748b" size="sm">
                Loading stay policies...
              </Text>
            </Group>
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={spacing[3]}>
            {POLICY_DEFINITIONS.map((definition) => {
              const policy = policyFor(policies, definition.type);

              return (
                <Card key={definition.type} radius={radius.lg} p={18} style={panelStyle}>
                  <Stack gap={14}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Group gap={12} align="flex-start" wrap="nowrap">
                        <ThemeIcon color="stayosBrand" radius="md" size={40} variant="light">
                          {definition.icon}
                        </ThemeIcon>

                        <Box>
                          <Group gap={8} wrap="wrap">
                            <Text c="#101828" fw={850}>
                              {definition.title}
                            </Text>

                            <Badge
                              color={policy ? (policy.isActive ? 'green' : 'gray') : 'yellow'}
                              variant="light"
                            >
                              {policy ? (policy.isActive ? 'Active' : 'Paused') : 'Set up'}
                            </Badge>
                          </Group>

                          <Text c="#64748b" size="sm" mt={4}>
                            {definition.description}
                          </Text>
                        </Box>
                      </Group>
                    </Group>

                    <Divider color="#eef2f6" />

                    <Box>
                      <Text c="#94a3b8" size="xs" fw={700}>
                        CURRENT RULE
                      </Text>

                      <Text c="#101828" fw={750} size="sm" mt={4}>
                        {summary(definition, policy)}
                      </Text>
                    </Box>

                    <Group justify="flex-end">
                      <Button
                        color="stayosBrand"
                        variant={policy ? 'light' : 'filled'}
                        disabled={!canManage}
                        onClick={() => openEditor(definition)}
                      >
                        {policy ? 'Edit policy' : 'Set up policy'}
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </Stack>

      <Modal
        centered
        opened={Boolean(editingDefinition)}
        onClose={closeEditor}
        radius={radius.lg}
        size="lg"
        title={
          editingDefinition ? (
            <Box>
              <Text c="#101828" fw={850} size="lg">
                {editingDefinition.title}
              </Text>

              <Text c="#64748b" size="sm" mt={2}>
                {editingDefinition.description}
              </Text>
            </Box>
          ) : null
        }
      >
        {editingDefinition ? (
          <Stack gap={spacing[4]}>
            <Switch
              checked={form.isActive}
              disabled={saving}
              label="Use this policy"
              description="Pause it when you want StayOS to keep the rule saved but stop applying it."
              onChange={(event) => {
                const checked = event.currentTarget.checked;

                setForm((current) => ({
                  ...current,
                  isActive: checked,
                }));
              }}
            />

            {editingDefinition.kind === 'deposit' ? (
              <>
                <Select
                  label="Deposit required"
                  description="Choose how the advance should be calculated."
                  disabled={saving}
                  data={[
                    {
                      label: 'No deposit required',
                      value: 'NONE',
                    },
                    {
                      label: 'Percentage of booking total',
                      value: 'PERCENTAGE',
                    },
                    {
                      label: 'Fixed amount',
                      value: 'FIXED_AMOUNT',
                    },
                  ]}
                  value={form.depositMode}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      depositMode: (value ?? 'NONE') as DepositPolicyMode,
                      depositValue: value === 'NONE' ? '' : current.depositValue,
                    }))
                  }
                />

                {form.depositMode === 'PERCENTAGE' ? (
                  <NumberInput
                    label="Deposit percentage"
                    min={1}
                    max={100}
                    suffix=" %"
                    disabled={saving}
                    value={form.depositValue}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        depositValue: value,
                      }))
                    }
                  />
                ) : null}

                {form.depositMode === 'FIXED_AMOUNT' ? (
                  <NumberInput
                    label="Deposit amount"
                    min={1}
                    prefix="₹ "
                    thousandSeparator=","
                    disabled={saving}
                    value={form.depositValue}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        depositValue: value,
                      }))
                    }
                  />
                ) : null}
              </>
            ) : (
              <>
                <Select
                  label="Fee"
                  description="Choose what StayOS should show staff when this policy is triggered."
                  disabled={saving}
                  data={[
                    {
                      label: 'No fee',
                      value: 'NONE',
                    },
                    {
                      label: 'Percentage',
                      value: 'PERCENTAGE',
                    },
                    {
                      label: 'Fixed amount',
                      value: 'FIXED_AMOUNT',
                    },
                    ...(editingDefinition.allowFirstNight
                      ? [
                          {
                            label: "Charge first night's room rate",
                            value: 'FIRST_NIGHT',
                          },
                        ]
                      : []),
                  ]}
                  value={form.chargeMode}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      chargeMode: (value ?? 'NONE') as PolicyChargeMode,
                      chargeValue:
                        value === 'PERCENTAGE' || value === 'FIXED_AMOUNT'
                          ? current.chargeValue
                          : '',
                    }))
                  }
                />

                {form.chargeMode === 'PERCENTAGE' ? (
                  <NumberInput
                    label="Fee percentage"
                    min={1}
                    max={100}
                    suffix=" %"
                    disabled={saving}
                    value={form.chargeValue}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        chargeValue: value,
                      }))
                    }
                  />
                ) : null}

                {form.chargeMode === 'FIXED_AMOUNT' ? (
                  <NumberInput
                    label="Fee amount"
                    min={1}
                    prefix="₹ "
                    thousandSeparator=","
                    disabled={saving}
                    value={form.chargeValue}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        chargeValue: value,
                      }))
                    }
                  />
                ) : null}

                {editingDefinition.hasCancellationWindow ? (
                  <NumberInput
                    label="Free cancellation until"
                    description="How many hours before arrival can the guest cancel without this fee?"
                    min={0}
                    max={8760}
                    suffix=" hours before arrival"
                    disabled={saving}
                    value={form.cancellationCutoffHours}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        cancellationCutoffHours: value,
                      }))
                    }
                  />
                ) : null}

                {editingDefinition.hasGracePeriod ? (
                  <NumberInput
                    label="Grace period"
                    description={
                      editingDefinition.type === 'EARLY_CHECK_IN'
                        ? 'Do not treat the arrival as chargeable early check-in during this grace period.'
                        : 'Do not treat the departure as chargeable late checkout during this grace period.'
                    }
                    min={0}
                    max={1440}
                    suffix=" minutes"
                    disabled={saving}
                    value={form.graceMinutes}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        graceMinutes: value,
                      }))
                    }
                  />
                ) : null}
              </>
            )}

            {validationError ? (
              <Alert color="red" variant="light">
                {validationError}
              </Alert>
            ) : (
              <Alert color="blue" variant="light">
                {editingDefinition.type === 'EARLY_CHECK_IN' ||
                editingDefinition.type === 'LATE_CHECKOUT'
                  ? 'StayOS will show this policy to Front Desk staff. The fee is posted only after staff approval.'
                  : 'StayOS will use this as the property-level default. Rate-plan overrides can be added later without changing this rule.'}
              </Alert>
            )}

            {!policyFor(policies, editingDefinition.type) ? (
              <Text c="#64748b" size="xs">
                Starter values are suggestions only. Nothing is saved until you click Save policy.
              </Text>
            ) : null}

            <Group justify="flex-end">
              <Button color="gray" variant="subtle" disabled={saving} onClick={closeEditor}>
                Cancel
              </Button>

              <Button
                color="stayosBrand"
                leftSection={<Save size={15} />}
                disabled={Boolean(validationError)}
                loading={saving}
                onClick={() => void savePolicy()}
              >
                Save policy
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
