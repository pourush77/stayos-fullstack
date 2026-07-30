import { Button, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { spacing } from '@stayos/theme';
import type { MaintenanceTicketCategory, MaintenanceTicketPriority } from '../api/maintenance-api';

export function CreateMaintenanceTicketModal({
  onClose,
  onCreate,
  opened,
}: {
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
  opened: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [roomId, setRoomId] = useState('');
  const [category, setCategory] = useState<MaintenanceTicketCategory>('OTHER');
  const [priority, setPriority] = useState<MaintenanceTicketPriority>('NORMAL');

  const reset = () => {
    setTitle('');
    setDescription('');
    setRoomId('');
    setCategory('OTHER');
    setPriority('NORMAL');
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Create maintenance ticket" centered>
      <Stack gap={spacing[4]}>
        <TextInput label="Title" maxLength={120} value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        <Textarea label="Description" minRows={3} value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
        <TextInput label="Room ID" description="Optional for public-area work" value={roomId} onChange={(event) => setRoomId(event.currentTarget.value)} />
        <Select label="Category" data={['PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'OTHER']} value={category} onChange={(value) => setCategory((value ?? 'OTHER') as MaintenanceTicketCategory)} />
        <Select label="Priority" data={['LOW', 'NORMAL', 'HIGH']} value={priority} onChange={(value) => setPriority((value ?? 'NORMAL') as MaintenanceTicketPriority)} />
        <Button
          color="stayosBrand"
          leftSection={<CheckCircle2 size={16} />}
          disabled={!title.trim()}
          onClick={() => void onCreate({
            title: title.trim(),
            description,
            roomId: roomId.trim() || undefined,
            category,
            priority,
          }).then(() => {
            reset();
            onClose();
          })}
        >
          Create Ticket
        </Button>
      </Stack>
    </Modal>
  );
}
