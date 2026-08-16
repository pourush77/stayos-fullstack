'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Building2, Save } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { getProperties, updateProperty } from '../../../lib/guest-api';

type DepositPolicyType = 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT';

type PropertySettingsDto = {
  id: string;
  name?: string;
  groupBookingDepositPolicyType?: DepositPolicyType;
  groupBookingDepositPolicyValue?: number | null;
};

const panelStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.95)',
  boxShadow: '0 8px 28px rgba(15,23,42,0.055)',
};

export default function PropertySettingsPage() {
  const [property, setProperty] = useState<PropertySettingsDto | null>(null);
  const [policyType, setPolicyType] = useState<DepositPolicyType>('NONE');
  const [policyValue, setPolicyValue] = useState<number | ''>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
        setProperty(active);
        setError(undefined);
        setPolicyType(active.groupBookingDepositPolicyType ?? 'NONE');
        setPolicyValue(
          active.groupBookingDepositPolicyType === 'NONE'
            ? ''
            : Number(active.groupBookingDepositPolicyValue ?? 0),
        );
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('We could not load property settings. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

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

  const save = async () => {
    if (!property || valueError) return;
    setIsSaving(true);
    try {
      const payload =
        policyType === 'NONE'
          ? { groupBookingDepositPolicyType: policyType }
          : {
              groupBookingDepositPolicyType: policyType,
              groupBookingDepositPolicyValue: Number(policyValue) || 0,
            };
      const updated = (await updateProperty(property.id, {
        ...payload,
      })) as PropertySettingsDto;
      setProperty(updated);
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
      setIsSaving(false);
    }
  };

  return (
    <Stack gap={spacing[3]} data-testid="property-settings">
      <Box>
        <Group gap={10}>
          <Building2 size={26} color="#7d4dd6" />
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>
            Property
          </Title>
        </Group>
        <Text c="#64748b" mt={4} style={{ fontSize: 14 }}>
          Configure hotel-level policies used by Front Desk workflows.
        </Text>
      </Box>

      {error ? <Alert color="red">{error}</Alert> : null}

      <Card radius={radius.lg} p={20} style={panelStyle}>
        <Stack gap={spacing[3]}>
          <Box>
            <Text c="#101828" fw={850} size="lg">
              Group booking deposit
            </Text>
            <Text c="#64748b" size="sm" mt={4}>
              Set the advance amount normally required to confirm a group booking.
            </Text>
          </Box>

          <Select
            data={[
              { label: 'No deposit required', value: 'NONE' },
              { label: 'Percentage of booking total', value: 'PERCENTAGE' },
              { label: 'Fixed amount', value: 'FIXED_AMOUNT' },
            ]}
            disabled={isLoading}
            label="Deposit policy"
            onChange={(value) => {
              const next = (value ?? 'NONE') as DepositPolicyType;
              setPolicyType(next);
              if (next === 'NONE') setPolicyValue('');
            }}
            value={policyType}
          />

          {policyType === 'PERCENTAGE' ? (
            <NumberInput
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
              disabled={Boolean(valueError) || isLoading}
              leftSection={<Save size={14} />}
              loading={isSaving}
              onClick={() => void save()}
            >
              Save Policy
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
