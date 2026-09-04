'use client';

import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { spacing } from '@stayos/theme';
import { formatStayDates } from '../utils/booking-formatters';

export type ExtendableGroupStay = {
  arrivalDate: string;
  departureDate: string;
  groupCode: string;
  groupName: string;
  roomCount?: number;
};

export function GroupExtendStayModal({
  opened,
  group,
  departureDate,
  error,
  isLoading,
  onClose,
  onDepartureDateChange,
  onSubmit,
}: {
  opened: boolean;
  group: ExtendableGroupStay | null;
  departureDate: string;
  error?: string;
  isLoading: boolean;
  onClose: () => void;
  onDepartureDateChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Extend group stay">
      <Stack gap={spacing[3]}>
        <Text fw={700}>
          {group?.groupCode} - {group?.groupName}
        </Text>
        <Text size="sm" c="#475569">
          {group?.roomCount ?? 0} rooms affected. Current stay:{' '}
          {group ? formatStayDates(group.arrivalDate, group.departureDate) : ''}
        </Text>
        <TextInput
          label="New departure date"
          type="date"
          value={departureDate}
          onChange={(event) => onDepartureDateChange(event.currentTarget.value)}
        />
        {error ? <Alert color="red">{error}</Alert> : null}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="stayosBrand"
            loading={isLoading}
            disabled={!departureDate || (group ? departureDate <= group.departureDate : true)}
            onClick={onSubmit}
          >
            Extend Stay
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
