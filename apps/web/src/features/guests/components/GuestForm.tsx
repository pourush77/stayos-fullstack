'use client';

import { useMemo, useState } from 'react';
import {
  Autocomplete,
  Button,
  Checkbox,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { Save } from 'lucide-react';
import { spacing } from '@stayos/theme';
import { guestStatusOptions } from '../constants/guest.constants';
import { preferredLanguageOptions } from '../constants/languages';
import { nationalityOptions } from '../constants/nationalities';
import type { Guest, GuestFormValues, GuestStatus } from '../types/guest.types';
import { guestToFormValues } from '../utils/guest-mappers';
import {
  hasGuestFormErrors,
  validateGuestForm,
  type GuestFormErrors,
} from '../utils/guest-validation';

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

  const updateValue = <Key extends keyof GuestFormValues>(
    key: Key,
    value: GuestFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const updateNameValue = (key: 'firstName' | 'lastName', value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      const currentGeneratedName = `${current.firstName.trim()} ${current.lastName.trim()}`.trim();
      if (
        !guest &&
        (!current.displayName.trim() || current.displayName.trim() === currentGeneratedName)
      ) {
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
          disabled={isSubmitting}
          value={values.firstName}
        />
        <TextInput
          error={errors.lastName}
          label="Last name"
          onChange={(event) => updateNameValue('lastName', event.currentTarget.value)}
          required
          disabled={isSubmitting}
          value={values.lastName}
        />
        <TextInput
          label="Display name"
          description="Name shown across front-desk screens."
          disabled={isSubmitting}
          onChange={(event) => updateValue('displayName', event.currentTarget.value)}
          value={values.displayName}
        />
        <TextInput
          error={errors.phone}
          label="Phone"
          inputMode="tel"
          disabled={isSubmitting}
          onChange={(event) => updateValue('phone', event.currentTarget.value)}
          required
          value={values.phone}
        />
        <TextInput
          error={errors.email}
          label="Email"
          type="email"
          disabled={isSubmitting}
          onChange={(event) => updateValue('email', event.currentTarget.value)}
          value={values.email}
        />
        <TextInput
          label="Alternate phone"
          inputMode="tel"
          disabled={isSubmitting}
          onChange={(event) => updateValue('alternatePhone', event.currentTarget.value)}
          value={values.alternatePhone}
        />
        <Autocomplete
          data={nationalityOptions}
          label="Nationality"
          disabled={isSubmitting}
          onChange={(value) => updateValue('nationality', value)}
          value={values.nationality}
        />
        <Autocomplete
          data={preferredLanguageOptions}
          label="Preferred language"
          disabled={isSubmitting}
          onChange={(value) => updateValue('preferredLanguage', value)}
          value={values.preferredLanguage}
        />
        <Select
          data={guestStatusOptions}
          label="Status"
          disabled={isSubmitting}
          onChange={(value) => updateValue('status', (value as GuestStatus | null) ?? 'ACTIVE')}
          value={values.status}
        />
      </SimpleGrid>

      <Group gap={spacing[4]}>
        <Checkbox
          checked={values.vipStatus}
          disabled={isSubmitting}
          label="VIP"
          onChange={(event) => updateValue('vipStatus', event.currentTarget.checked)}
        />
        <Checkbox
          checked={values.blacklistStatus}
          disabled={isSubmitting}
          label="Blacklisted"
          onChange={(event) => updateValue('blacklistStatus', event.currentTarget.checked)}
        />
      </Group>
      {values.blacklistStatus ? (
        <Text c="red.7" size="sm" fw={700}>
          Blacklisted guests should be reviewed before creating or confirming a new reservation.
        </Text>
      ) : null}

      <Stack gap={spacing[2]}>
        <Text c="#101828" fw={800}>
          Preferences
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
          <TextInput
            label="Room preference"
            disabled={isSubmitting}
            onChange={(event) => updateValue('roomPreference', event.currentTarget.value)}
            value={values.roomPreference}
          />
          <Select
            data={['King', 'Queen', 'Twin', 'Any']}
            label="Bed preference"
            disabled={isSubmitting}
            onChange={(value) => updateValue('bedPreference', value ?? 'Any')}
            value={values.bedPreference}
          />
          <Select
            data={['Non-smoking', 'Smoking', 'No preference']}
            label="Smoking preference"
            disabled={isSubmitting}
            onChange={(value) => updateValue('smokingPreference', value ?? 'No preference')}
            value={values.smokingPreference}
          />
          <TextInput
            label="Floor preference"
            disabled={isSubmitting}
            onChange={(event) => updateValue('floorPreference', event.currentTarget.value)}
            value={values.floorPreference}
          />
          <Textarea
            label="Dietary notes"
            disabled={isSubmitting}
            minRows={3}
            onChange={(event) => updateValue('dietaryNotes', event.currentTarget.value)}
            value={values.dietaryNotes}
          />
          <Textarea
            label="Notes"
            disabled={isSubmitting}
            minRows={3}
            onChange={(event) => updateValue('notes', event.currentTarget.value)}
            value={values.notes}
          />
        </SimpleGrid>
      </Stack>

      <Group justify="flex-end" gap={8} wrap="wrap">
        <Button variant="subtle" color="gray" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          color="stayosBrand"
          leftSection={<Save size={16} />}
          loading={isSubmitting}
          disabled={isSubmitting}
          onClick={() => void submit()}
        >
          Save Guest
        </Button>
      </Group>
    </Stack>
  );
}
