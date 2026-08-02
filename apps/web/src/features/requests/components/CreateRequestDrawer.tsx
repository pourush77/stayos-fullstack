import { Button, Drawer, Paper, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { colors, radius, spacing, typography } from '@stayos/theme';
import type { GuestRequestDepartment, GuestRequestPriority, GuestRequestSuggestionDto } from '../api/guest-requests-api';

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function CreateRequestDrawer({
  onClose,
  onCreate,
  opened,
  selected,
  context,
}: {
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
  opened: boolean;
  selected?: GuestRequestSuggestionDto;
  context?: {
    department?: GuestRequestDepartment;
    guestId?: string;
    reservationId?: string;
    roomId?: string;
  };
}) {
  const [title, setTitle] = useState(selected?.title ?? '');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<GuestRequestPriority>('NORMAL');
  const [department, setDepartment] = useState<GuestRequestDepartment>(selected?.department ?? context?.department ?? 'HOUSEKEEPING');

  useEffect(() => {
    setTitle(selected?.title ?? '');
    setDescription('');
    setPriority('NORMAL');
    setDepartment(selected?.department ?? context?.department ?? 'HOUSEKEEPING');
  }, [context?.department, selected, opened]);

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="min(92vw, 480px)" title="Create guest request">
      <Stack gap={spacing[4]}>
        <TextInput label="Request Type" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        <Textarea label="Optional Notes" placeholder="Add anything the team should know" minRows={3} value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
        <Select
          label="Department"
          data={[
            { label: 'Housekeeping', value: 'HOUSEKEEPING' },
            { label: 'Laundry', value: 'LAUNDRY' },
            { label: 'Maintenance', value: 'MAINTENANCE' },
            { label: 'Reception', value: 'RECEPTION' },
            { label: 'Concierge', value: 'CONCIERGE' },
            { label: 'Food & Beverage', value: 'F_AND_B' },
          ]}
          value={department}
          onChange={(value) => setDepartment((value ?? 'HOUSEKEEPING') as GuestRequestDepartment)}
        />
        <Select label="Priority" data={['NORMAL', 'HIGH', 'VIP']} value={priority} onChange={(value) => setPriority((value ?? 'NORMAL') as GuestRequestPriority)} />
        <Paper p={spacing[4]} radius={radius.lg} bg={colors.brand[50]}>
          <Text c={colors.text.muted} style={typography.styles.caption}>Smart Assignment</Text>
          <Text c={colors.text.strong} mt={spacing[1]} style={typography.styles.label}>
            StayOS will route this to {label(department)} for Room context.
          </Text>
        </Paper>
        <Button
          color="stayosBrand"
          leftSection={<CheckCircle2 size={16} />}
          disabled={!title.trim()}
          onClick={() => void onCreate({
            ...context,
            title: title.trim(),
            description,
            priority,
            department,
          }).then(onClose)}
        >
          Done
        </Button>
      </Stack>
    </Drawer>
  );
}
