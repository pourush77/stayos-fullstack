'use client';

import { useMemo, useState } from 'react';
import { Autocomplete, Button, Checkbox, Group, Select, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { Save } from 'lucide-react';
import { spacing } from '@stayos/theme';
import { guestStatusOptions } from '../constants/guest.constants';
import { preferredLanguageOptions } from '../constants/languages';
import { nationalityOptions } from '../constants/nationalities';
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

  const updateNameValue = (key: 'firstName' | 'lastName', value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      const currentGeneratedName = `${current.firstName.trim()} ${current.lastName.trim()}`.trim();
      if (!guest && (!current.displayName.trim() || current.displayName.trim() === currentGeneratedName)) {
        next.displayName = `${next.firstName.trim()} ${next.lastName.trim()}`.trim();
      }
      return next;
    });
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
          onChange={(event) => updateNameValue('firstName', event.currentTarget.value)}
          required
          value={values.firstName}
        />
        <TextInput
          error={errors.lastName}
          label="Last name"
          onChange={(event) => updateNameValue('lastName', event.currentTarget.value)}
          required
          value={values.lastName}
        />
        <TextInput
          label="Display name"
          onChange={(event) => updateValue('displayName', event.currentTarget.value)}
          value={values.displayName}
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
        <Autocomplete
          data={nationalityOptions}
          label="Nationality"
          onChange={(value) => updateValue('nationality', value)}
          value={values.nationality}
        />
        <Autocomplete
          data={preferredLanguageOptions}
          label="Preferred language"
          onChange={(value) => updateValue('preferredLanguage', value)}
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

      <Stack gap={spacing[2]}>
        <Text c="#101828" fw={800}>Preferences</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
          <TextInput
            label="Room preference"
            onChange={(event) => updateValue('roomPreference', event.currentTarget.value)}
            value={values.roomPreference}
          />
          <Select
            data={['King', 'Queen', 'Twin', 'Any']}
            label="Bed preference"
            onChange={(value) => updateValue('bedPreference', value ?? 'Any')}
            value={values.bedPreference}
          />
          <Select
            data={['Non-smoking', 'Smoking', 'No preference']}
            label="Smoking preference"
            onChange={(value) => updateValue('smokingPreference', value ?? 'No preference')}
            value={values.smokingPreference}
          />
          <TextInput
            label="Floor preference"
            onChange={(event) => updateValue('floorPreference', event.currentTarget.value)}
            value={values.floorPreference}
          />
          <Textarea
            label="Dietary notes"
            minRows={3}
            onChange={(event) => updateValue('dietaryNotes', event.currentTarget.value)}
            value={values.dietaryNotes}
          />
          <Textarea
            label="Notes"
            minRows={3}
            onChange={(event) => updateValue('notes', event.currentTarget.value)}
            value={values.notes}
          />
        </SimpleGrid>
      </Stack>

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
