'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { Building2, CheckCircle2, Clock3, Save, Users } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { getProperties, updateProperty } from '../../../lib/guest-api';

type DepositPolicyType = 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT';

type PropertySettingsDto = {
  id: string;
  name?: string;

  checkInTime?: string | null;
  checkOutTime?: string | null;

  groupBookingDepositPolicyType?: DepositPolicyType;
  groupBookingDepositPolicyValue?: number | null;
};

const DEFAULT_CHECK_IN_TIME = '14:00';
const DEFAULT_CHECK_OUT_TIME = '12:00';

const panelStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.95)',
  boxShadow: '0 8px 28px rgba(15,23,42,0.055)',
};

function normalizeTime(value?: string | null, fallback = '') {
  if (!value) return fallback;

  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return fallback;

  return `${match[1]}:${match[2]}`;
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return value;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

export default function PropertySettingsPage() {
  const [property, setProperty] = useState<PropertySettingsDto | null>(null);

  const [checkInTime, setCheckInTime] = useState(DEFAULT_CHECK_IN_TIME);
  const [checkOutTime, setCheckOutTime] = useState(DEFAULT_CHECK_OUT_TIME);
  const [savedCheckInTime, setSavedCheckInTime] = useState(DEFAULT_CHECK_IN_TIME);
  const [savedCheckOutTime, setSavedCheckOutTime] = useState(DEFAULT_CHECK_OUT_TIME);

  const [policyType, setPolicyType] = useState<DepositPolicyType>('NONE');
  const [policyValue, setPolicyValue] = useState<number | ''>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTimings, setIsSavingTimings] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const controller = new AbortController();

    getProperties(controller.signal)
      .then((properties) => {
        if (controller.signal.aborted) return;

        const active = properties[0] as PropertySettingsDto | undefined;

        if (!active?.id) {
          setError('No property is available to configure.');
          return;
        }

        const initialCheckInTime = normalizeTime(active.checkInTime, DEFAULT_CHECK_IN_TIME);

        const initialCheckOutTime = normalizeTime(active.checkOutTime, DEFAULT_CHECK_OUT_TIME);

        setProperty(active);
        setError(undefined);

        setCheckInTime(initialCheckInTime);
        setCheckOutTime(initialCheckOutTime);
        setSavedCheckInTime(initialCheckInTime);
        setSavedCheckOutTime(initialCheckOutTime);

        setPolicyType(active.groupBookingDepositPolicyType ?? 'NONE');
        setPolicyValue(
          active.groupBookingDepositPolicyType === 'NONE'
            ? ''
            : Number(active.groupBookingDepositPolicyValue ?? 0),
        );
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;

        setError('We could not load property settings. Please refresh and try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const timingsChanged = checkInTime !== savedCheckInTime || checkOutTime !== savedCheckOutTime;

  const timingsValid = /^\d{2}:\d{2}$/.test(checkInTime) && /^\d{2}:\d{2}$/.test(checkOutTime);

  const valueError = useMemo(() => {
    const value = Number(policyValue) || 0;

    if (policyType === 'PERCENTAGE' && (value <= 0 || value > 100)) {
      return 'Enter a percentage greater than 0 and up to 100.';
    }

    if (policyType === 'FIXED_AMOUNT' && value <= 0) {
      return 'Enter an amount greater than 0.';
    }

    return undefined;
  }, [policyType, policyValue]);

  const saveTimings = async () => {
    if (!property || !timingsChanged || !timingsValid) return;

    setIsSavingTimings(true);

    try {
      const updated = (await updateProperty(property.id, {
        checkInTime,
        checkOutTime,
      })) as PropertySettingsDto;

      const nextCheckInTime = normalizeTime(updated.checkInTime, checkInTime);

      const nextCheckOutTime = normalizeTime(updated.checkOutTime, checkOutTime);

      setProperty((current) => ({
        ...current,
        ...updated,
      }));

      setCheckInTime(nextCheckInTime);
      setCheckOutTime(nextCheckOutTime);
      setSavedCheckInTime(nextCheckInTime);
      setSavedCheckOutTime(nextCheckOutTime);

      showToast({
        color: 'green',
        message: 'Front Desk will use these times to identify early arrivals and late departures.',
        title: 'Hotel timings saved',
      });
    } catch {
      showToast({
        color: 'red',
        message: 'We could not save the hotel timings. Your previous settings are unchanged.',
        title: 'Save failed',
      });
    } finally {
      setIsSavingTimings(false);
    }
  };

  const saveDepositPolicy = async () => {
    if (!property || valueError) return;

    setIsSavingPolicy(true);

    try {
      const payload =
        policyType === 'NONE'
          ? {
              groupBookingDepositPolicyType: policyType,
            }
          : {
              groupBookingDepositPolicyType: policyType,
              groupBookingDepositPolicyValue: Number(policyValue) || 0,
            };

      const updated = (await updateProperty(property.id, {
        ...payload,
      })) as PropertySettingsDto;

      setProperty((current) => ({
        ...current,
        ...updated,
      }));

      setPolicyType(updated.groupBookingDepositPolicyType ?? 'NONE');

      setPolicyValue(
        updated.groupBookingDepositPolicyType === 'NONE'
          ? ''
          : Number(updated.groupBookingDepositPolicyValue ?? 0),
      );

      showToast({
        color: 'green',
        message: 'The suggested group booking deposit will now use this hotel policy.',
        title: 'Policy saved',
      });
    } catch {
      showToast({
        color: 'red',
        message: 'We could not save the group booking deposit policy.',
        title: 'Save failed',
      });
    } finally {
      setIsSavingPolicy(false);
    }
  };

  return (
    <Stack gap={spacing[4]} data-testid="property-settings">
      <Box>
        <Group gap={10}>
          <Building2 size={26} color="#7d4dd6" />

          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
            Property
          </Title>
        </Group>

        <Text c="#64748b" mt={4} style={{ fontSize: 14 }}>
          Set the everyday rules StayOS uses to guide your Front Desk team.
        </Text>
      </Box>

      {error ? <Alert color="red">{error}</Alert> : null}

      <Card radius={radius.lg} p={20} style={panelStyle}>
        <Stack gap={spacing[4]}>
          <Group justify="space-between" align="flex-start">
            <Group gap={12} align="flex-start">
              <ThemeIcon color="stayosBrand" radius="md" size={38} variant="light">
                <Clock3 size={19} />
              </ThemeIcon>

              <Box>
                <Text c="#101828" fw={850} size="lg">
                  Hotel timings
                </Text>

                <Text c="#64748b" size="sm" mt={3}>
                  Set the usual arrival and departure times for your property.
                </Text>
              </Box>
            </Group>

            {!isLoading && !timingsChanged ? (
              <Group gap={5}>
                <CheckCircle2 size={15} color="#16a34a" />
                <Text c="#16a34a" size="sm" fw={650}>
                  Saved
                </Text>
              </Group>
            ) : null}
          </Group>

          <Divider color="#eef2f6" />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Box>
              <TextInput
                disabled={isLoading || isSavingTimings}
                label="Standard check-in"
                onChange={(event) => setCheckInTime(event.currentTarget.value)}
                type="time"
                value={checkInTime}
              />

              <Text c="#64748b" size="xs" mt={7} lh={1.45}>
                Guests arriving before{' '}
                <Text component="span" inherit fw={700} c="#475569">
                  {formatTime(checkInTime)}
                </Text>{' '}
                may need early check-in approval.
              </Text>
            </Box>

            <Box>
              <TextInput
                disabled={isLoading || isSavingTimings}
                label="Standard check-out"
                onChange={(event) => setCheckOutTime(event.currentTarget.value)}
                type="time"
                value={checkOutTime}
              />

              <Text c="#64748b" size="xs" mt={7} lh={1.45}>
                Guests staying after{' '}
                <Text component="span" inherit fw={700} c="#475569">
                  {formatTime(checkOutTime)}
                </Text>{' '}
                may need late checkout approval.
              </Text>
            </Box>
          </SimpleGrid>

          <Alert color="blue" variant="light">
            StayOS uses these times to guide the Front Desk. Early check-in or late checkout fees
            are never added just because the clock passes a certain time — your configured policy
            and staff approval control those charges.
          </Alert>

          <Group justify="space-between" align="center">
            <Text c="#64748b" size="sm">
              {timingsChanged
                ? 'You have unsaved timing changes.'
                : `Current timings: ${formatTime(savedCheckInTime)} check-in · ${formatTime(
                    savedCheckOutTime,
                  )} check-out`}
            </Text>

            <Button
              color="stayosBrand"
              disabled={isLoading || !timingsChanged || !timingsValid || isSavingPolicy}
              leftSection={<Save size={14} />}
              loading={isSavingTimings}
              onClick={() => void saveTimings()}
            >
              Save timings
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card radius={radius.lg} p={20} style={panelStyle}>
        <Stack gap={spacing[3]}>
          <Group gap={12} align="flex-start">
            <ThemeIcon color="stayosBrand" radius="md" size={38} variant="light">
              <Users size={19} />
            </ThemeIcon>

            <Box>
              <Text c="#101828" fw={850} size="lg">
                Group booking deposit
              </Text>

              <Text c="#64748b" size="sm" mt={3}>
                Set the advance amount normally required to confirm a group booking.
              </Text>
            </Box>
          </Group>

          <Divider color="#eef2f6" />

          <Select
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
            disabled={isLoading || isSavingPolicy}
            label="Deposit policy"
            onChange={(value) => {
              const next = (value ?? 'NONE') as DepositPolicyType;

              setPolicyType(next);

              if (next === 'NONE') {
                setPolicyValue('');
              }
            }}
            value={policyType}
          />

          {policyType === 'PERCENTAGE' ? (
            <NumberInput
              disabled={isSavingPolicy}
              error={valueError}
              label="Deposit required"
              max={100}
              min={1}
              onChange={(value) => setPolicyValue(typeof value === 'number' ? value : 0)}
              suffix=" %"
              value={policyValue}
            />
          ) : null}

          {policyType === 'FIXED_AMOUNT' ? (
            <NumberInput
              disabled={isSavingPolicy}
              error={valueError}
              label="Deposit required"
              min={1}
              onChange={(value) => setPolicyValue(typeof value === 'number' ? value : 0)}
              prefix="₹ "
              thousandSeparator=","
              value={policyValue}
            />
          ) : null}

          <Group justify="flex-end">
            <Button
              color="stayosBrand"
              disabled={Boolean(valueError) || isLoading || isSavingTimings}
              leftSection={<Save size={14} />}
              loading={isSavingPolicy}
              onClick={() => void saveDepositPolicy()}
            >
              Save policy
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
