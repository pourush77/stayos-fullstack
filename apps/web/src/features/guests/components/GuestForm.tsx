'use client';

import { useMemo, useState } from 'react';
import { Button, Checkbox, Group, Select, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { Save } from 'lucide-react';
import { spacing } from '@stayos/theme';
import { guestStatusOptions } from '../constants/guest.constants';
import type { Guest, GuestFormValues, GuestStatus } from '../types/guest.types';
import { guestToFormValues } from '../utils/guest-mappers';
import { hasGuestFormErrors, validateGuestForm, type GuestFormErrors } from '../utils/guest-validation';

export function GuestForm({
  guest,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  guest?: Guest;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (values: GuestFormValues) => Promise<void>;
}) {
  const initialValues = useMemo(() => guestToFormValues(guest), [guest]);
  const [values, setValues] = useState<GuestFormValues>(initialValues);
  const [errors, setErrors] = useState<GuestFormErrors>({});

  const updateValue = <Key extends keyof GuestFormValues>(key: Key, value: GuestFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async () => {
    const nextErrors = validateGuestForm(values);
    setErrors(nextErrors);

    if (hasGuestFormErrors(nextErrors)) return;

    await onSubmit(values);
  };

  return (
    <Stack gap={spacing[4]}>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
        <TextInput
          error={errors.firstName}
          label="First name"
          onChange={(event) => updateValue('firstName', event.currentTarget.value)}
          required
          value={values.firstName}
        />
        <TextInput
          error={errors.lastName}
          label="Last name"
          onChange={(event) => updateValue('lastName', event.currentTarget.value)}
          required
          value={values.lastName}
        />
        <TextInput
          error={errors.phone}
          label="Phone"
          onChange={(event) => updateValue('phone', event.currentTarget.value)}
          required
          value={values.phone}
        />
        <TextInput
          error={errors.email}
          label="Email"
          onChange={(event) => updateValue('email', event.currentTarget.value)}
          value={values.email}
        />
        <TextInput
          label="Alternate phone"
          onChange={(event) => updateValue('alternatePhone', event.currentTarget.value)}
          value={values.alternatePhone}
        />
        <TextInput
          label="Nationality"
          onChange={(event) => updateValue('nationality', event.currentTarget.value)}
          value={values.nationality}
        />
        <TextInput
          label="Preferred language"
          onChange={(event) => updateValue('preferredLanguage', event.currentTarget.value)}
          value={values.preferredLanguage}
        />
        <Select
          data={guestStatusOptions}
          label="Status"
          onChange={(value) => updateValue('status', (value as GuestStatus | null) ?? 'ACTIVE')}
          value={values.status}
        />
      </SimpleGrid>

      <Group gap={spacing[4]}>
        <Checkbox
          checked={values.vipStatus}
          label="VIP"
          onChange={(event) => updateValue('vipStatus', event.currentTarget.checked)}
        />
        <Checkbox
          checked={values.blacklistStatus}
          label="Blacklisted"
          onChange={(event) => updateValue('blacklistStatus', event.currentTarget.checked)}
        />
      </Group>

      <Group justify="flex-end">
        <Button variant="subtle" color="gray" onClick={onCancel}>
          Cancel
        </Button>
        <Button color="stayosBrand" leftSection={<Save size={16} />} loading={isSubmitting} onClick={() => void submit()}>
          Save Guest
        </Button>
      </Group>
    </Stack>
  );
}
