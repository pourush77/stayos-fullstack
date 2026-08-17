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
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  CalendarDays,
  IndianRupee,
  Pencil,
  Plus,
  ReceiptIndianRupee,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { useAuth } from '../../../features/auth/auth-context';
import {
  createTaxRule,
  deleteTaxRule,
  getTaxRules,
  updateTaxRule,
  type CreateTaxRulePayload,
  type TaxRuleChargeType,
  type TaxRuleDto,
} from '../../../features/rates/api/rates-api';

const panelStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.95)',
  boxShadow: '0 8px 28px rgba(15,23,42,0.055)',
};

const CHARGE_TYPE_OPTIONS: Array<{
  value: TaxRuleChargeType;
  label: string;
  description: string;
}> = [
  {
    value: 'ROOM',
    label: 'Room accommodation',
    description: 'Room / nightly accommodation charges.',
  },
  {
    value: 'FOOD_AND_BEVERAGE',
    label: 'Food & beverage',
    description: 'Restaurant, room-service and food or beverage charges.',
  },
  {
    value: 'MINIBAR',
    label: 'Minibar',
    description: 'Items charged from the guest room minibar.',
  },
  {
    value: 'LAUNDRY',
    label: 'Laundry',
    description: 'Laundry and garment-care services.',
  },
  {
    value: 'SPA',
    label: 'Spa',
    description: 'Spa and wellness services.',
  },
  {
    value: 'MISC',
    label: 'Other hotel charges',
    description: 'Other taxable services that do not fit a category above.',
  },
];

type RuleFormState = {
  name: string;
  chargeType: TaxRuleChargeType;
  hsnSac: string;
  taxPercentage: number | string;
  useSlab: boolean;
  slabMinAmount: number | string;
  slabMaxAmount: number | string;
  effectiveFrom: string;
  isActive: boolean;
};

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

function emptyForm(): RuleFormState {
  return {
    name: '',
    chargeType: 'ROOM',
    hsnSac: '',
    taxPercentage: '',
    useSlab: false,
    slabMinAmount: '',
    slabMaxAmount: '',
    effectiveFrom: todayDate(),
    isActive: true,
  };
}

function chargeTypeLabel(type: TaxRuleChargeType) {
  return (
    CHARGE_TYPE_OPTIONS.find((option) => option.value === type)?.label ??
    type
      .toLowerCase()
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function money(value: string | null) {
  if (value == null || value === '') return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;

  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
    style: 'currency',
  }).format(parsed);
}

function slabLabel(rule: TaxRuleDto) {
  const min = money(rule.slabMinAmount);
  const max = money(rule.slabMaxAmount);

  if (!min && !max) return 'Any amount';
  if (min && max) return `${min} – ${max}`;
  if (min) return `${min} and above`;
  return `Up to ${max}`;
}

function displayDate(value: string) {
  if (!value) return 'Not set';

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function toOptionalMoneyString(value: number | string) {
  if (value === '' || value == null) return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;

  return parsed.toFixed(2);
}

export default function TaxesSettingsPage() {
  const auth = useAuth();
  const propertyId = auth.user?.propertyId ?? '';
  const canManage = hasPermission(auth.user?.permissions, 'settings.manage');

  const [rules, setRules] = useState<TaxRuleDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editorOpened, setEditorOpened] = useState(false);
  const [editingRule, setEditingRule] = useState<TaxRuleDto | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<TaxRuleDto | null>(null);

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setLoadError('');

    void getTaxRules(propertyId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setRules(data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;

        setLoadError(
          error instanceof Error ? error.message : 'We could not load GST rules. Please try again.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [propertyId]);

  const validationError = useMemo(() => {
    if (!form.name.trim()) return 'Give this rule a clear name.';
    if (!form.chargeType) return 'Choose what this tax rule applies to.';

    const rate = Number(form.taxPercentage);
    if (!Number.isFinite(rate)) return 'Enter the GST rate.';
    if (rate < 0 || rate > 100) return 'GST rate must be between 0% and 100%.';

    if (!form.effectiveFrom) return 'Choose when this rule starts applying.';

    if (form.useSlab) {
      const min = form.slabMinAmount === '' ? null : Number(form.slabMinAmount);
      const max = form.slabMaxAmount === '' ? null : Number(form.slabMaxAmount);

      if (min !== null && (!Number.isFinite(min) || min < 0)) {
        return 'Minimum amount cannot be negative.';
      }

      if (max !== null && (!Number.isFinite(max) || max < 0)) {
        return 'Maximum amount cannot be negative.';
      }

      if (min !== null && max !== null && max < min) {
        return 'Maximum amount must be greater than or equal to the minimum amount.';
      }
    }

    return '';
  }, [form]);

  const resetEditor = () => {
    setEditorOpened(false);
    setEditingRule(null);
    setForm(emptyForm());
  };

  const openCreate = () => {
    setEditingRule(null);
    setForm(emptyForm());
    setEditorOpened(true);
  };

  const openEdit = (rule: TaxRuleDto) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      chargeType: rule.chargeType,
      hsnSac: rule.hsnSac ?? '',
      taxPercentage: Number(rule.taxPercentage),
      useSlab: rule.slabMinAmount !== null || rule.slabMaxAmount !== null,
      slabMinAmount: rule.slabMinAmount === null ? '' : Number(rule.slabMinAmount),
      slabMaxAmount: rule.slabMaxAmount === null ? '' : Number(rule.slabMaxAmount),
      effectiveFrom: rule.effectiveFrom.slice(0, 10),
      isActive: rule.isActive,
    });
    setEditorOpened(true);
  };

  const closeEditor = () => {
    if (saving) return;
    resetEditor();
  };

  const saveRule = async () => {
    if (!propertyId || !canManage || validationError) return;

    const slabMinAmount = toOptionalMoneyString(form.slabMinAmount);
    const slabMaxAmount = toOptionalMoneyString(form.slabMaxAmount);

    const payload: CreateTaxRulePayload = {
      name: form.name.trim(),
      chargeType: form.chargeType,
      taxPercentage: Number(form.taxPercentage).toFixed(2),
      effectiveFrom: form.effectiveFrom,
      isActive: form.isActive,
      ...(form.hsnSac.trim() ? { hsnSac: form.hsnSac.trim() } : {}),
      ...(form.useSlab
        ? {
            ...(slabMinAmount ? { slabMinAmount } : {}),
            ...(slabMaxAmount ? { slabMaxAmount } : {}),
          }
        : {}),
    };

    setSaving(true);

    try {
      if (editingRule) {
        const updated = await updateTaxRule(propertyId, editingRule.id, payload);

        setRules((current) => current.map((rule) => (rule.id === updated.id ? updated : rule)));

        showToast({
          color: 'green',
          title: 'Tax rule updated',
          message:
            'StayOS will use the updated rule for new matching charges from its effective date.',
        });
      } else {
        const created = await createTaxRule(propertyId, payload);

        setRules((current) => [...current, created]);

        showToast({
          color: 'green',
          title: 'Tax rule added',
          message: 'StayOS will automatically use this rule when a matching charge is posted.',
        });
      }

      resetEditor();
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Could not save tax rule',
        message: error instanceof Error ? error.message : 'Please check the values and try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: TaxRuleDto, isActive: boolean) => {
    if (!propertyId || !canManage) return;

    setBusyRuleId(rule.id);

    try {
      const updated = await updateTaxRule(propertyId, rule.id, { isActive });

      setRules((current) => current.map((item) => (item.id === updated.id ? updated : item)));

      showToast({
        color: 'green',
        title: isActive ? 'Tax rule activated' : 'Tax rule paused',
        message: isActive
          ? 'StayOS can use this rule for new matching charges.'
          : 'New charges will no longer use this rule while it is paused.',
      });
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Could not update tax rule',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setBusyRuleId(null);
    }
  };

  const removeRule = async () => {
    if (!propertyId || !deleteCandidate || !canManage) return;

    const candidate = deleteCandidate;
    setBusyRuleId(candidate.id);

    try {
      await deleteTaxRule(propertyId, candidate.id);

      setRules((current) => current.filter((rule) => rule.id !== candidate.id));
      setDeleteCandidate(null);

      showToast({
        color: 'green',
        title: 'Tax rule removed',
        message:
          'Historical charges keep their saved GST details. This only removes the rule for future matching charges.',
      });
    } catch (error) {
      showToast({
        color: 'red',
        title: 'Could not remove tax rule',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setBusyRuleId(null);
    }
  };

  if (!hasPermission(auth.user?.permissions, 'settings.view')) {
    return (
      <Alert color="red" variant="light" radius={radius.lg}>
        You do not have permission to view tax settings.
      </Alert>
    );
  }

  return (
    <>
      <Stack gap={spacing[4]} data-testid="tax-settings-page">
        <Group justify="space-between" align="flex-end">
          <Box>
            <Group gap={10}>
              <ReceiptIndianRupee size={26} color="#7d4dd6" />
              <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
                Taxes & Charges
              </Title>
            </Group>

            <Text c="#64748b" mt={4} style={{ fontSize: 14 }}>
              Set the GST rules StayOS should use when hotel charges are posted.
            </Text>
          </Box>

          {canManage ? (
            <Button color="stayosBrand" leftSection={<Plus size={16} />} onClick={openCreate}>
              Add tax rule
            </Button>
          ) : null}
        </Group>

        <Alert color="blue" radius={radius.lg} icon={<ShieldCheck size={18} />} variant="light">
          <Text fw={700} size="sm">
            Old bills stay unchanged
          </Text>
          <Text size="sm" mt={2}>
            StayOS saves the GST used on every posted charge. Changing or removing a rule later does
            not rewrite historical folios or invoices.
          </Text>
        </Alert>

        {loadError ? (
          <Alert color="red" radius={radius.lg} variant="light">
            <Group justify="space-between" align="center">
              <Text size="sm">{loadError}</Text>
              <Button size="compact-sm" variant="subtle" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </Group>
          </Alert>
        ) : null}

        {isLoading ? (
          <Paper radius={radius.lg} p={28} style={panelStyle} data-testid="tax-rules-loading">
            <Group justify="center" gap={10}>
              <Loader size="sm" color="stayosBrand" />
              <Text c="#64748b" size="sm">
                Loading GST rules...
              </Text>
            </Group>
          </Paper>
        ) : rules.length === 0 ? (
          <Paper radius={radius.lg} p={28} style={panelStyle}>
            <Stack align="center" gap={12} ta="center">
              <ThemeIcon color="stayosBrand" radius="xl" size={48} variant="light">
                <IndianRupee size={22} />
              </ThemeIcon>

              <Box>
                <Text c="#101828" fw={800} size="lg">
                  No GST rules configured yet
                </Text>
                <Text c="#64748b" size="sm" mt={4} maw={560}>
                  StayOS will not invent a tax rate. Add the rules approved for your property before
                  you start issuing GST-taxed folios.
                </Text>
              </Box>

              {canManage ? (
                <Button color="stayosBrand" leftSection={<Plus size={16} />} onClick={openCreate}>
                  Add your first tax rule
                </Button>
              ) : null}
            </Stack>
          </Paper>
        ) : (
          <Stack gap={12}>
            {rules.map((rule) => (
              <Card
                key={rule.id}
                radius={radius.lg}
                p={18}
                style={{
                  ...panelStyle,
                  opacity: rule.isActive ? 1 : 0.72,
                  transition: 'box-shadow 160ms ease, transform 160ms ease, opacity 160ms ease',
                }}
                data-testid={`tax-rule-${rule.id}`}
              >
                <Stack gap={14}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Group gap={12} align="flex-start" wrap="nowrap">
                      <ThemeIcon
                        color={rule.isActive ? 'stayosBrand' : 'gray'}
                        radius="md"
                        size={40}
                        variant="light"
                      >
                        <ReceiptIndianRupee size={19} />
                      </ThemeIcon>

                      <Box>
                        <Group gap={8} wrap="wrap">
                          <Text c="#101828" fw={850} size="md">
                            {rule.name}
                          </Text>

                          <Badge color={rule.isActive ? 'green' : 'gray'} variant="light">
                            {rule.isActive ? 'Active' : 'Paused'}
                          </Badge>
                        </Group>

                        <Text c="#475569" size="sm" mt={3} fw={650}>
                          {chargeTypeLabel(rule.chargeType)}
                        </Text>
                      </Box>
                    </Group>

                    {canManage ? (
                      <Group gap={6} wrap="nowrap">
                        <Tooltip label="Edit rule" withArrow>
                          <Button
                            aria-label={`Edit ${rule.name}`}
                            color="gray"
                            size="compact-sm"
                            variant="subtle"
                            leftSection={<Pencil size={14} />}
                            onClick={() => openEdit(rule)}
                          >
                            Edit
                          </Button>
                        </Tooltip>

                        <Tooltip label="Remove rule" withArrow>
                          <Button
                            aria-label={`Remove ${rule.name}`}
                            color="red"
                            size="compact-sm"
                            variant="subtle"
                            onClick={() => setDeleteCandidate(rule)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </Tooltip>
                      </Group>
                    ) : null}
                  </Group>

                  <Divider color="#eef2f6" />

                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg">
                    <Box>
                      <Text c="#94a3b8" size="xs" fw={700}>
                        GST RATE
                      </Text>
                      <Text c="#101828" fw={800} mt={3}>
                        {Number(rule.taxPercentage).toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                        })}
                        %
                      </Text>
                    </Box>

                    <Box>
                      <Text c="#94a3b8" size="xs" fw={700}>
                        HSN / SAC
                      </Text>
                      <Text c="#101828" fw={750} mt={3}>
                        {rule.hsnSac || 'Not set'}
                      </Text>
                    </Box>

                    <Box>
                      <Text c="#94a3b8" size="xs" fw={700}>
                        AMOUNT RANGE
                      </Text>
                      <Text c="#101828" fw={750} mt={3}>
                        {slabLabel(rule)}
                      </Text>
                    </Box>

                    <Box>
                      <Text c="#94a3b8" size="xs" fw={700}>
                        EFFECTIVE FROM
                      </Text>
                      <Group gap={5} mt={3}>
                        <CalendarDays size={14} color="#64748b" />
                        <Text c="#101828" fw={750}>
                          {displayDate(rule.effectiveFrom)}
                        </Text>
                      </Group>
                    </Box>
                  </SimpleGrid>

                  {canManage ? (
                    <Group justify="space-between" align="center">
                      <Text c="#64748b" size="xs">
                        {rule.isActive
                          ? 'StayOS may use this rule for new matching charges.'
                          : 'This rule is kept for reference but is not used for new charges.'}
                      </Text>

                      <Switch
                        checked={rule.isActive}
                        disabled={busyRuleId === rule.id}
                        label={rule.isActive ? 'Active' : 'Paused'}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          void toggleRule(rule, checked);
                        }}
                      />
                    </Group>
                  ) : null}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>

      <Modal
        centered
        opened={editorOpened}
        onClose={closeEditor}
        radius={radius.lg}
        size="lg"
        title={
          <Box>
            <Text c="#101828" fw={850} size="lg">
              {editingRule ? 'Edit tax rule' : 'Add tax rule'}
            </Text>
            <Text c="#64748b" size="sm" mt={2}>
              Tell StayOS when and where this GST rule should apply.
            </Text>
          </Box>
        }
      >
        <Stack gap={spacing[4]}>
          <TextInput
            autoFocus
            disabled={saving}
            label="Rule name"
            placeholder="Example: Room accommodation"
            description="Use a name your manager or accountant will recognise later."
            maxLength={120}
            value={form.name}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setForm((current) => ({
                ...current,
                name: value,
              }));
            }}
          />

          <Select
            disabled={saving}
            label="What is this tax for?"
            description="StayOS matches the rule to this type of folio charge."
            data={CHARGE_TYPE_OPTIONS.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            value={form.chargeType}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                chargeType: (value ?? 'ROOM') as TaxRuleChargeType,
              }))
            }
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <TextInput
              disabled={saving}
              label="HSN / SAC"
              placeholder="Example: 996311"
              description="Enter the code your accountant uses for this service."
              maxLength={16}
              value={form.hsnSac}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({
                  ...current,
                  hsnSac: value,
                }));
              }}
            />

            <NumberInput
              allowDecimal
              decimalScale={2}
              disabled={saving}
              label="GST rate"
              description="Combined GST rate. StayOS handles the tax split when the charge is posted."
              min={0}
              max={100}
              suffix=" %"
              value={form.taxPercentage}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  taxPercentage: value,
                }))
              }
            />
          </SimpleGrid>

          <Paper
            radius={radius.md}
            p={16}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <Stack gap={12}>
              <Group justify="space-between" align="center">
                <Box>
                  <Text c="#101828" fw={750} size="sm">
                    Different rate by amount
                  </Text>
                  <Text c="#64748b" size="xs" mt={2}>
                    Turn this on only when this rule applies to a specific per-unit tariff or amount
                    range.
                  </Text>
                </Box>

                <Switch
                  checked={form.useSlab}
                  disabled={saving}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;

                    setForm((current) => ({
                      ...current,
                      useSlab: checked,
                      slabMinAmount: checked ? current.slabMinAmount : '',
                      slabMaxAmount: checked ? current.slabMaxAmount : '',
                    }));
                  }}
                />
              </Group>

              {form.useSlab ? (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                  <NumberInput
                    allowDecimal
                    decimalScale={2}
                    disabled={saving}
                    label="From amount"
                    min={0}
                    placeholder="No minimum"
                    prefix="₹ "
                    thousandSeparator=","
                    value={form.slabMinAmount}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        slabMinAmount: value,
                      }))
                    }
                  />

                  <NumberInput
                    allowDecimal
                    decimalScale={2}
                    disabled={saving}
                    label="Up to amount"
                    min={0}
                    placeholder="No maximum"
                    prefix="₹ "
                    thousandSeparator=","
                    value={form.slabMaxAmount}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        slabMaxAmount: value,
                      }))
                    }
                  />
                </SimpleGrid>
              ) : null}
            </Stack>
          </Paper>

          <TextInput
            disabled={saving}
            label="Effective from"
            description="New matching charges use this rule from this date onward."
            type="date"
            value={form.effectiveFrom}
            onChange={(event) => {
              const value = event.currentTarget.value;

              setForm((current) => ({
                ...current,
                effectiveFrom: value,
              }));
            }}
          />

          <Switch
            checked={form.isActive}
            disabled={saving}
            label="Use this rule for new charges"
            description="You can pause the rule later without changing historical bills."
            onChange={(event) => {
              const checked = event.currentTarget.checked;

              setForm((current) => ({
                ...current,
                isActive: checked,
              }));
            }}
          />

          {validationError ? (
            <Alert color="red" variant="light">
              {validationError}
            </Alert>
          ) : (
            <Alert color="blue" variant="light">
              StayOS will choose the matching effective rule when a charge is posted and save the
              applied GST with that charge.
            </Alert>
          )}

          <Group justify="flex-end">
            <Button variant="subtle" color="gray" disabled={saving} onClick={closeEditor}>
              Cancel
            </Button>

            <Button
              color="stayosBrand"
              disabled={Boolean(validationError)}
              loading={saving}
              onClick={() => void saveRule()}
            >
              {editingRule ? 'Save changes' : 'Add tax rule'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        centered
        opened={Boolean(deleteCandidate)}
        onClose={() => {
          if (!busyRuleId) setDeleteCandidate(null);
        }}
        radius={radius.lg}
        size="sm"
        title="Remove tax rule?"
      >
        <Stack gap={spacing[3]}>
          <Text c="#475569" size="sm">
            {deleteCandidate ? (
              <>
                <Text component="span" inherit fw={750} c="#101828">
                  {deleteCandidate.name}
                </Text>{' '}
                will stop being available for future charges.
              </>
            ) : null}
          </Text>

          <Alert color="blue" variant="light">
            Existing folio charges and finalized invoices keep the GST details that were already
            saved on them.
          </Alert>

          <Group justify="flex-end">
            <Button
              color="gray"
              variant="subtle"
              disabled={Boolean(busyRuleId)}
              onClick={() => setDeleteCandidate(null)}
            >
              Keep rule
            </Button>

            <Button
              color="red"
              leftSection={<Trash2 size={15} />}
              loading={Boolean(deleteCandidate && busyRuleId === deleteCandidate.id)}
              onClick={() => void removeRule()}
            >
              Remove rule
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
