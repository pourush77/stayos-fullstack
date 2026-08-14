'use client';

import { Alert, Box, Button, Group, NumberInput, Paper, Stack, Switch, TextInput } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import { getPropertyTaxConfig, upsertPropertyTaxConfig } from '../../../features/rates/api/rates-api';
import { useAuth } from '../../../features/auth/auth-context';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

export default function TaxesSettingsPage() {
  const auth = useAuth();
  const propertyId = auth.user?.propertyId ?? '';
  const canManage = hasPermission(auth.user?.permissions, 'settings.manage');
  const [isActive, setIsActive] = useState(true);
  const [name, setName] = useState('GST');
  const [percentage, setPercentage] = useState<number | string>(12);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const percentageNumber = typeof percentage === 'number' ? percentage : Number(percentage);
  const fieldError = useMemo(() => {
    if (isActive && !name.trim()) return 'Tax name is required when tax is enabled.';
    if (!Number.isFinite(percentageNumber)) return 'Tax percentage is required.';
    if (percentageNumber < 0) return 'Tax percentage cannot be negative.';
    if (percentageNumber > 100) return 'Tax percentage cannot exceed 100%.';
    return '';
  }, [isActive, name, percentageNumber]);

  const roomCharges = 3500;
  const childCharges = 850;
  const taxableSubtotal = roomCharges + childCharges;
  const taxAmount = isActive ? Math.round(taxableSubtotal * (percentageNumber / 100)) : 0;
  const total = taxableSubtotal + taxAmount;

  useEffect(() => {
    if (!propertyId) return;
    const controller = new AbortController();
    void getPropertyTaxConfig(propertyId, controller.signal)
      .then((config) => {
        setIsActive(config.isActive);
        setName(config.name);
        setPercentage(Number(config.percentage));
        setError('');
      })
      .catch(() => setError('Unable to load tax configuration.'));

    return () => controller.abort();
  }, [propertyId]);

  async function save() {
    if (!propertyId || fieldError) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const config = await upsertPropertyTaxConfig(propertyId, {
        isActive,
        name: name.trim(),
        percentage: Number(percentageNumber).toFixed(2),
      });
      setIsActive(config.isActive);
      setName(config.name);
      setPercentage(Number(config.percentage));
      setSuccess('Tax configuration saved successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save tax configuration.');
    } finally {
      setSaving(false);
    }
  }

  if (!hasPermission(auth.user?.permissions, 'settings.view')) {
    return <Alert color="red" variant="light" radius={radius.lg}>You do not have permission to view tax settings.</Alert>;
  }

  return (
    <Stack gap={spacing[4]} data-testid="tax-settings-page">
      <Box>
        <h1 style={{ color: '#101828', fontSize: 30, fontWeight: 750, margin: 0 }}>
          Taxes & Charges
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>
          Configure the property tax applied to booking and folio charges.
        </p>
      </Box>

      {error ? <Alert color="red" variant="light" radius={radius.lg}>{error}</Alert> : null}
      {success ? <Alert color="green" variant="light" radius={radius.lg}>{success}</Alert> : null}

      <Paper radius={radius.lg} p={20} style={{ border: '1px solid rgba(226, 232, 240, 0.9)' }}>
        <Stack gap={spacing[4]}>
          <Group justify="space-between" align="center">
            <Box>
              <h2 style={{ color: '#101828', fontSize: 18, fontWeight: 800, margin: 0 }}>
                Property tax
              </h2>
              <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
                Percentage of taxable amount.
              </p>
            </Box>
            <Switch
              data-testid="tax-enabled-toggle"
              checked={isActive}
              disabled={!canManage}
              label={isActive ? 'Enabled' : 'Disabled'}
              onChange={(event) => setIsActive(event.currentTarget.checked)}
            />
          </Group>

          <TextInput
            data-testid="tax-name-input"
            disabled={!canManage}
            error={isActive && !name.trim() ? 'Tax name is required.' : undefined}
            label="Tax name"
            maxLength={80}
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />

          <NumberInput
            data-testid="tax-percentage-input"
            allowDecimal
            decimalScale={2}
            disabled={!canManage}
            error={fieldError && fieldError.includes('percentage') ? fieldError : undefined}
            label="Tax percentage"
            min={0}
            max={100}
            onChange={setPercentage}
            suffix="%"
            value={percentage}
          />

          {fieldError ? (
            <p style={{ color: '#b42318', fontSize: 13, margin: 0 }}>{fieldError}</p>
          ) : null}

          <Paper radius={radius.md} p={16} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Stack gap={8}>
              <Group justify="space-between">
                <span style={{ color: '#64748b', fontSize: 14 }}>Room charges</span>
                <strong>{formatCurrency(roomCharges)}</strong>
              </Group>
              <Group justify="space-between">
                <span style={{ color: '#64748b', fontSize: 14 }}>Child charges</span>
                <strong>{formatCurrency(childCharges)}</strong>
              </Group>
              <Group justify="space-between">
                <span style={{ color: '#64748b', fontSize: 14 }}>Taxable subtotal</span>
                <strong>{formatCurrency(taxableSubtotal)}</strong>
              </Group>
              {isActive ? (
                <Group justify="space-between">
                  <span style={{ color: '#64748b', fontSize: 14 }}>
                    {name.trim() || 'Tax'} {Number(percentageNumber || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%
                  </span>
                  <strong>{formatCurrency(taxAmount)}</strong>
                </Group>
              ) : null}
              <Group justify="space-between" pt={8} style={{ borderTop: '1px solid #e2e8f0' }}>
                <span style={{ color: '#101828', fontSize: 14, fontWeight: 900 }}>Total</span>
                <strong style={{ fontSize: 20 }}>{formatCurrency(total)}</strong>
              </Group>
            </Stack>
          </Paper>

          <Group justify="flex-end">
            <Button
              data-testid="tax-save-button"
              color="stayosBrand"
              disabled={!canManage || Boolean(fieldError)}
              loading={saving}
              onClick={save}
            >
              Save tax settings
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
