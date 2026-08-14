'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { BadgeIndianRupee, Baby, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { useAuth } from '../../../features/auth/auth-context';
import {
  getGuestPricingPolicy,
  upsertGuestPricingPolicy,
  type ChildAgeBandDto,
  type ChildPricingMode,
  type UpsertGuestPricingPolicyPayload,
} from '../../../features/rates/api/rates-api';

type ChildAgeBand = {
  id: string;
  label: string;
  minAge: number;
  maxAge: number;
  pricingMode: ChildPricingMode;
  fixedAmount?: string;
  percentage?: string;
};

const pricingModeOptions = [
  { value: 'FREE', label: 'Free' },
  { value: 'FIXED_PER_NIGHT', label: 'Fixed amount per night' },
  { value: 'PERCENT_OF_ROOM_RATE', label: '% of room rate' },
  { value: 'ADULT_PRICING', label: 'Use adult pricing' },
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
    pricingMode: 'FIXED_PER_NIGHT',
    fixedAmount: '800.00',
  },
  {
    id: 'older-child',
    label: 'Older Child',
    minAge: 12,
    maxAge: 17,
    pricingMode: 'ADULT_PRICING',
  },
];

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
} as const;

const pageTitleStyle = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.2,
  fontWeight: 750,
  color: '#101828',
} as const;

const sectionTitleStyle = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.4,
  fontWeight: 800,
  color: '#101828',
} as const;

const bodyStyle = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.5,
  color: '#64748b',
} as const;

const helperStyle = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.45,
  color: '#667085',
} as const;

const mutedStyle = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.45,
  color: '#94a3b8',
} as const;

function pricingSummary(band: ChildAgeBand) {
  switch (band.pricingMode) {
    case 'FREE':
      return 'Free';

    case 'FIXED_PER_NIGHT':
      return `₹${band.fixedAmount ?? '0'} / child / night`;

    case 'PERCENT_OF_ROOM_RATE':
      return `${band.percentage ?? '0'}% of room rate`;

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

export default function RatesSettingsPage() {
  const auth = useAuth();

  const propertyId = auth.user?.propertyId;

  const [ageBasedPricingEnabled, setAgeBasedPricingEnabled] = useState(true);
  const [maximumChildAge, setMaximumChildAge] = useState(17);
  const [bands, setBands] = useState<ChildAgeBand[]>(initialBands);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();

    async function loadPolicy() {
      if (!propertyId) {
        setLoading(false);
        setError('No property is assigned to the current user.');
        return;
      }

      try {
        setLoading(true);
        setError(undefined);

        const response = await getGuestPricingPolicy(propertyId, controller.signal);

        if (!response) {
          setAgeBasedPricingEnabled(true);
          setMaximumChildAge(17);
          setBands(initialBands);
          return;
        }

        setAgeBasedPricingEnabled(response.policy.ageBasedChildPricingEnabled);

        setMaximumChildAge(response.policy.maximumChildAge);

        setBands(
          response.childAgeBands
            .slice()
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map(mapApiBand),
        );
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load guest pricing policy.',
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPolicy();

    return () => {
      controller.abort();
    };
  }, [propertyId]);

  const sortedBands = useMemo(() => [...bands].sort((a, b) => a.minAge - b.minAge), [bands]);

  function updateBand(id: string, changes: Partial<ChildAgeBand>) {
    setBands((currentBands) =>
      currentBands.map((band) =>
        band.id === id
          ? {
              ...band,
              ...changes,
            }
          : band,
      ),
    );

    setSuccessMessage(undefined);
  }

  function handlePricingModeChange(id: string, value: string | null) {
    if (!value) {
      return;
    }

    const pricingMode = value as ChildPricingMode;

    setBands((currentBands) =>
      currentBands.map((band) => {
        if (band.id !== id) {
          return band;
        }

        return {
          ...band,
          pricingMode,
          fixedAmount: pricingMode === 'FIXED_PER_NIGHT' ? (band.fixedAmount ?? '0.00') : undefined,
          percentage: pricingMode === 'PERCENT_OF_ROOM_RATE' ? (band.percentage ?? '0') : undefined,
        };
      }),
    );

    setSuccessMessage(undefined);
  }

  function addAgeBand() {
    const lastBand = sortedBands[sortedBands.length - 1];

    const minAge = lastBand ? lastBand.maxAge + 1 : 0;

    const newBand: ChildAgeBand = {
      id: `new-${Date.now()}`,
      label: 'New age band',
      minAge,
      maxAge: Math.max(minAge, maximumChildAge),
      pricingMode: 'ADULT_PRICING',
    };

    setBands((currentBands) => [...currentBands, newBand]);
    setSuccessMessage(undefined);
  }

  function removeAgeBand(id: string) {
    setBands((currentBands) => currentBands.filter((band) => band.id !== id));

    setSuccessMessage(undefined);
  }

  function validateBeforeSave(): string | undefined {
    if (!Number.isInteger(maximumChildAge) || maximumChildAge < 0) {
      return 'Maximum child age must be a whole non-negative number.';
    }

    if (!ageBasedPricingEnabled) {
      return undefined;
    }

    if (sortedBands.length === 0) {
      return 'Add at least one child age rule.';
    }

    if (sortedBands[0].minAge !== 0) {
      return 'Child age rules must start from age 0.';
    }

    for (let index = 0; index < sortedBands.length; index += 1) {
      const band = sortedBands[index];

      if (!band.label.trim()) {
        return 'Every child age rule must have a label.';
      }

      if (!Number.isInteger(band.minAge) || !Number.isInteger(band.maxAge)) {
        return 'Child ages must be whole numbers.';
      }

      if (band.minAge < 0 || band.maxAge < 0) {
        return 'Child ages cannot be negative.';
      }

      if (band.maxAge < band.minAge) {
        return `The "${band.label}" age range is invalid.`;
      }

      if (band.maxAge > maximumChildAge) {
        return `"${band.label}" exceeds the maximum child age.`;
      }

      if (index > 0) {
        const previousBand = sortedBands[index - 1];

        if (band.minAge !== previousBand.maxAge + 1) {
          return 'Child age rules must be continuous without gaps or overlaps.';
        }
      }

      if (band.pricingMode === 'FIXED_PER_NIGHT' && !band.fixedAmount?.trim()) {
        return `"${band.label}" requires a fixed amount.`;
      }

      if (band.pricingMode === 'PERCENT_OF_ROOM_RATE' && !band.percentage?.trim()) {
        return `"${band.label}" requires a percentage.`;
      }
    }

    const lastBand = sortedBands[sortedBands.length - 1];

    if (lastBand.maxAge !== maximumChildAge) {
      return `Child age rules must cover every age through ${maximumChildAge}.`;
    }

    return undefined;
  }

  async function handleSave() {
    if (!propertyId) {
      setError('No property is assigned to the current user.');
      return;
    }

    const validationError = validateBeforeSave();

    if (validationError) {
      setError(validationError);
      setSuccessMessage(undefined);
      return;
    }

    try {
      setSaving(true);
      setError(undefined);
      setSuccessMessage(undefined);

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
                ? {
                    fixedAmount: band.fixedAmount ?? '0.00',
                  }
                : {}),
              ...(band.pricingMode === 'PERCENT_OF_ROOM_RATE'
                ? {
                    percentage: band.percentage ?? '0',
                  }
                : {}),
              displayOrder: index,
              isActive: true,
            }))
          : [],
      };

      const response = await upsertGuestPricingPolicy(propertyId, payload);

      setAgeBasedPricingEnabled(response.policy.ageBasedChildPricingEnabled);

      setMaximumChildAge(response.policy.maximumChildAge);

      setBands(
        response.childAgeBands
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(mapApiBand),
      );

      setSuccessMessage('Guest pricing policy saved successfully.');
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Unable to save guest pricing policy.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Stack align="center" justify="center" gap="md" style={{ minHeight: 320 }}>
        <Loader size="md" />

        <p style={bodyStyle}>Loading guest pricing policy...</p>
      </Stack>
    );
  }

  return (
    <Stack gap={spacing[4]} data-testid="rates-settings-page">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Group gap={10}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={42}>
              <BadgeIndianRupee size={21} />
            </ThemeIcon>

            <Box>
              <h1 style={pageTitleStyle}>Rates & Guest Pricing</h1>

              <p
                style={{
                  ...bodyStyle,
                  marginTop: 4,
                }}
              >
                Configure how StayOS prices children and guest occupancy.
              </p>
            </Box>
          </Group>
        </Box>

        <Button
          leftSection={<Save size={16} />}
          radius={radius.md}
          loading={saving}
          disabled={!propertyId}
          onClick={() => void handleSave()}
        >
          Save changes
        </Button>
      </Group>

      {error ? (
        <Alert
          color="red"
          title="Unable to complete the request"
          withCloseButton
          onClose={() => setError(undefined)}
        >
          {error}
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert
          color="green"
          title="Saved"
          withCloseButton
          onClose={() => setSuccessMessage(undefined)}
        >
          {successMessage}
        </Alert>
      ) : null}

      <Card radius={radius.lg} p={24} style={cardStyle}>
        <Group justify="space-between" align="center">
          <Group gap={12}>
            <ThemeIcon color="stayosBrand" variant="light" radius={radius.md} size={40}>
              <Baby size={20} />
            </ThemeIcon>

            <Box>
              <h2 style={sectionTitleStyle}>Child pricing</h2>

              <p
                style={{
                  ...bodyStyle,
                  marginTop: 2,
                }}
              >
                Apply different pricing based on the child&apos;s age.
              </p>
            </Box>
          </Group>

          <Switch
            checked={ageBasedPricingEnabled}
            onChange={(event) => {
              setAgeBasedPricingEnabled(event.currentTarget.checked);
              setSuccessMessage(undefined);
            }}
            size="md"
            label="Age-based pricing"
          />
        </Group>

        <Divider my={22} />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
          <Box>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.4,
                fontWeight: 700,
                color: '#344054',
              }}
            >
              Maximum child age
            </p>

            <p
              style={{
                ...helperStyle,
                marginTop: 3,
                marginBottom: 8,
              }}
            >
              Guests above this age are treated as adults.
            </p>

            <NumberInput
              value={maximumChildAge}
              onChange={(value) => {
                if (typeof value === 'number') {
                  setMaximumChildAge(value);
                  setSuccessMessage(undefined);
                }
              }}
              min={0}
              max={25}
              allowDecimal={false}
              suffix=" years"
              radius={radius.md}
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

              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#344054',
                }}
              >
                How StayOS will use this
              </p>
            </Group>

            <p
              style={{
                ...bodyStyle,
                marginTop: 8,
              }}
            >
              When children are added to a booking, StayOS will ask for their ages and automatically
              apply the matching pricing rule.
            </p>
          </Card>
        </SimpleGrid>
      </Card>

      <Card radius={radius.lg} p={24} style={cardStyle}>
        <Group justify="space-between" mb={18}>
          <Box>
            <h2 style={sectionTitleStyle}>Child age rules</h2>

            <p
              style={{
                ...bodyStyle,
                marginTop: 3,
              }}
            >
              Keep age ranges continuous so every child age has exactly one rule.
            </p>
          </Box>

          <Button
            variant="light"
            leftSection={<Plus size={15} />}
            radius={radius.md}
            disabled={!ageBasedPricingEnabled}
            onClick={addAgeBand}
          >
            Add age band
          </Button>
        </Group>

        {!ageBasedPricingEnabled ? (
          <Alert color="blue" title="Age-based pricing is disabled">
            Child age rules will not be used. Enable age-based pricing to configure child pricing
            bands.
          </Alert>
        ) : null}

        {ageBasedPricingEnabled && bands.length === 0 ? (
          <Alert color="yellow" title="No child age rules">
            Add age bands covering ages 0 through {maximumChildAge}.
          </Alert>
        ) : null}

        {ageBasedPricingEnabled ? (
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
                <Group justify="space-between" align="flex-start" mb={14}>
                  <Box>
                    <Group gap={8}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          lineHeight: 1.4,
                          fontWeight: 800,
                          color: '#101828',
                        }}
                      >
                        Age {band.minAge}–{band.maxAge}
                      </p>

                      <Badge variant="light" color="gray">
                        {pricingSummary(band)}
                      </Badge>
                    </Group>

                    <p
                      style={{
                        ...mutedStyle,
                        marginTop: 4,
                      }}
                    >
                      Applied automatically during booking
                    </p>
                  </Box>

                  <Button
                    variant="subtle"
                    color="red"
                    size="compact-sm"
                    leftSection={<Trash2 size={14} />}
                    onClick={() => removeAgeBand(band.id)}
                  >
                    Remove
                  </Button>
                </Group>

                <SimpleGrid
                  cols={{
                    base: 1,
                    sm: 2,
                    lg: 4,
                  }}
                  spacing={spacing[3]}
                >
                  <TextInput
                    label="Label"
                    value={band.label}
                    onChange={(event) =>
                      updateBand(band.id, {
                        label: event.currentTarget.value,
                      })
                    }
                    radius={radius.md}
                  />

                  <NumberInput
                    label="From age"
                    value={band.minAge}
                    min={0}
                    allowDecimal={false}
                    onChange={(value) => {
                      if (typeof value === 'number') {
                        updateBand(band.id, {
                          minAge: value,
                        });
                      }
                    }}
                    radius={radius.md}
                  />

                  <NumberInput
                    label="To age"
                    value={band.maxAge}
                    min={0}
                    allowDecimal={false}
                    onChange={(value) => {
                      if (typeof value === 'number') {
                        updateBand(band.id, {
                          maxAge: value,
                        });
                      }
                    }}
                    radius={radius.md}
                  />

                  <Select
                    label="Pricing"
                    value={band.pricingMode}
                    data={pricingModeOptions}
                    allowDeselect={false}
                    onChange={(value) => handlePricingModeChange(band.id, value)}
                    radius={radius.md}
                  />
                </SimpleGrid>

                {band.pricingMode === 'FIXED_PER_NIGHT' ? (
                  <Box mt={14} maw={260}>
                    <TextInput
                      label="Amount per child / night"
                      value={band.fixedAmount ?? ''}
                      onChange={(event) =>
                        updateBand(band.id, {
                          fixedAmount: event.currentTarget.value,
                        })
                      }
                      leftSection={
                        <span
                          style={{
                            fontSize: 14,
                            color: '#475467',
                          }}
                        >
                          ₹
                        </span>
                      }
                      radius={radius.md}
                    />
                  </Box>
                ) : null}

                {band.pricingMode === 'PERCENT_OF_ROOM_RATE' ? (
                  <Box mt={14} maw={260}>
                    <TextInput
                      label="% of room rate"
                      value={band.percentage ?? ''}
                      onChange={(event) =>
                        updateBand(band.id, {
                          percentage: event.currentTarget.value,
                        })
                      }
                      rightSection={
                        <span
                          style={{
                            fontSize: 14,
                            color: '#475467',
                          }}
                        >
                          %
                        </span>
                      }
                      radius={radius.md}
                    />
                  </Box>
                ) : null}
              </Card>
            ))}
          </Stack>
        ) : null}
      </Card>

      <Card
        radius={radius.lg}
        p={20}
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
        }}
      >
        <h2 style={sectionTitleStyle}>Current pricing example</h2>

        <p
          style={{
            ...bodyStyle,
            marginTop: 5,
          }}
        >
          StayOS will automatically select the pricing rule based on the child&apos;s age during
          booking.
        </p>

        {ageBasedPricingEnabled ? (
          <Group mt={12} gap={10}>
            {sortedBands.map((band) => (
              <Badge
                key={`example-${band.id}`}
                variant="light"
                color={
                  band.pricingMode === 'FREE'
                    ? 'green'
                    : band.pricingMode === 'FIXED_PER_NIGHT'
                      ? 'blue'
                      : 'gray'
                }
              >
                Age {band.minAge}–{band.maxAge} · {pricingSummary(band)}
              </Badge>
            ))}
          </Group>
        ) : (
          <p
            style={{
              ...bodyStyle,
              marginTop: 12,
            }}
          >
            Age-based child pricing is currently disabled.
          </p>
        )}
      </Card>
    </Stack>
  );
}
