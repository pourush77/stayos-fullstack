'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { AlertTriangle, BedDouble, CheckCircle2, UserRound } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import {
  createWalkInGroup,
  getAvailableRooms,
  type CreateWalkInGroupDto,
  type GroupCheckInResultDto,
  type OperationsAvailableRoomDto,
} from '../../../lib/operations-api';

type WalkInAssignment = {
  roomId: string;
  adults: number;
  children: number;
  guestName?: string;
};

function todayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString().slice(0, 10);
}

function tomorrowIso() {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  now.setHours(0, 0, 0, 0);
  return now.toISOString().slice(0, 10);
}

export function WalkInGroupModal({
  opened,
  onClose,
  propertyId,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  propertyId: string;
  onCreated: (result: GroupCheckInResultDto) => Promise<void> | void;
}) {
  const [arrivalDate, setArrivalDate] = useState<Date | null>(new Date(`${todayIso()}T00:00:00`));
  const [departureDate, setDepartureDate] = useState<Date | null>(
    new Date(`${tomorrowIso()}T00:00:00`),
  );
  const [groupName, setGroupName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [depositRequired, setDepositRequired] = useState(0);
  const [availableRooms, setAvailableRooms] = useState<OperationsAvailableRoomDto[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, WalkInAssignment>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<GroupCheckInResultDto | null>(null);

  const arrivalIso = arrivalDate ? arrivalDate.toISOString().slice(0, 10) : '';
  const departureIso = departureDate ? departureDate.toISOString().slice(0, 10) : '';

  const resetForm = useCallback(() => {
    setGroupName('');
    setLeadName('');
    setLeadPhone('');
    setLeadEmail('');
    setNotes('');
    setDepositRequired(0);
    setAssignments({});
    setError(undefined);
    setResult(null);
  }, []);

  useEffect(() => {
    if (!opened) return;
    resetForm();
    setArrivalDate(new Date(`${todayIso()}T00:00:00`));
    setDepartureDate(new Date(`${tomorrowIso()}T00:00:00`));
  }, [opened, resetForm]);

  useEffect(() => {
    if (!opened || !propertyId || !arrivalIso || !departureIso) return;
    if (departureIso <= arrivalIso) return;

    const controller = new AbortController();
    setIsLoadingRooms(true);
    (async () => {
      try {
        const rooms = await getAvailableRooms(
          propertyId,
          { arrivalDate: arrivalIso, departureDate: departureIso },
          controller.signal,
        );
        setAvailableRooms(rooms ?? []);
      } catch {
        if (!controller.signal.aborted) setAvailableRooms([]);
      } finally {
        if (!controller.signal.aborted) setIsLoadingRooms(false);
      }
    })();
    return () => controller.abort();
  }, [opened, propertyId, arrivalIso, departureIso]);

  const roomsByType = useMemo(() => {
    const groups = new Map<string, { name: string; rooms: OperationsAvailableRoomDto[] }>();
    availableRooms.forEach((room) => {
      const typeId = room.roomType?.id ?? '';
      const typeName = room.roomType?.name ?? 'Room';
      const existing = groups.get(typeId);
      if (existing) existing.rooms.push(room);
      else groups.set(typeId, { name: typeName, rooms: [room] });
    });
    return Array.from(groups.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [availableRooms]);

  const selectedList = useMemo(
    () => Object.values(assignments).sort((a, b) => a.roomId.localeCompare(b.roomId)),
    [assignments],
  );

  const totalAdults = selectedList.reduce((sum, a) => sum + a.adults, 0);
  const totalChildren = selectedList.reduce((sum, a) => sum + a.children, 0);

  function toggleRoom(room: OperationsAvailableRoomDto) {
    setAssignments((prev) => {
      const copy = { ...prev };
      if (copy[room.roomId]) {
        delete copy[room.roomId];
      } else {
        copy[room.roomId] = { roomId: room.roomId, adults: 2, children: 0 };
      }
      return copy;
    });
  }

  function updateAssignment(roomId: string, patch: Partial<WalkInAssignment>) {
    setAssignments((prev) => {
      const existing = prev[roomId];
      if (!existing) return prev;
      return { ...prev, [roomId]: { ...existing, ...patch } };
    });
  }

  const canSubmit =
    !isSaving &&
    !!arrivalIso &&
    !!departureIso &&
    departureIso > arrivalIso &&
    !!groupName.trim() &&
    !!leadName.trim() &&
    !!leadPhone.trim() &&
    selectedList.length > 0;

  async function submit() {
    if (!canSubmit) return;
    setError(undefined);
    setIsSaving(true);
    try {
      const body: CreateWalkInGroupDto = {
        arrivalDate: arrivalIso,
        departureDate: departureIso,
        groupName: groupName.trim(),
        leadName: leadName.trim(),
        leadPhone: leadPhone.trim(),
        leadEmail: leadEmail.trim() || undefined,
        notes: notes.trim() || undefined,
        depositRequired: depositRequired > 0 ? depositRequired : undefined,
        roomAssignments: selectedList.map((assignment) => ({
          roomId: assignment.roomId,
          adults: assignment.adults,
          children: assignment.children,
          guestName: assignment.guestName?.trim() || undefined,
        })),
      };
      const walkInResult = await createWalkInGroup(propertyId, body);
      setResult(walkInResult);
      showToast({
        color: 'green',
        title: 'Walk-in group checked in',
        message: `${walkInResult.group.groupCode} · ${walkInResult.occupiedRooms.length} rooms · ${walkInResult.masterFolioNumber}`,
      });
      await onCreated(walkInResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check in walk-in group.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="xl"
      title={
        <Group gap={10}>
          <UserRound size={20} />
          <Text fw={800} c="#101828" size="lg">
            Walk-in Group Check-in
          </Text>
        </Group>
      }
      data-testid="walk-in-group-modal"
    >
      {result ? (
        <Stack gap={spacing[3]}>
          <Alert
            color="green"
            icon={<CheckCircle2 size={18} />}
            title={`Group ${result.group.groupCode} is now in-house`}
          >
            <Stack gap={4} mt={4}>
              <Text size="sm">
                <b>Master folio:</b> {result.masterFolioNumber}
              </Text>
              <Text size="sm">
                <b>Occupied rooms:</b> {result.occupiedRooms.join(', ')}
              </Text>
              <Text size="sm">
                <b>Lead:</b> {result.group.leadName} · {result.group.leadPhone}
              </Text>
            </Stack>
          </Alert>
          <Group justify="space-between">
            <Button
              component={Link}
              href={`/reservations/group-holds/${result.group.id}/master-folio`}
              color="stayosBrand"
              variant="light"
              data-testid="walk-in-open-master-folio"
            >
              Open Master Folio
            </Button>
            <Button onClick={onClose} color="stayosBrand" data-testid="walk-in-close">
              Done
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap={spacing[3]}>
          <Text c="#64748b" size="sm">
            Guests are already at the front desk. Pick rooms from live availability, capture the
            group lead, and check everyone in with a single master folio.
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <DatePickerInput
              label="Arrival"
              value={arrivalDate}
              minDate={new Date(`${todayIso()}T00:00:00`)}
              onChange={(value) => setArrivalDate(value as Date | null)}
              required
              data-testid="walk-in-arrival"
            />
            <DatePickerInput
              label="Departure"
              value={departureDate}
              minDate={arrivalDate ?? new Date(`${todayIso()}T00:00:00`)}
              onChange={(value) => setDepartureDate(value as Date | null)}
              required
              data-testid="walk-in-departure"
            />
          </SimpleGrid>

          <TextInput
            label="Group name"
            placeholder="e.g. Sharma Wedding Group"
            value={groupName}
            onChange={(event) => setGroupName(event.currentTarget.value)}
            required
            data-testid="walk-in-group-name"
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <TextInput
              label="Lead name"
              value={leadName}
              onChange={(event) => setLeadName(event.currentTarget.value)}
              required
              data-testid="walk-in-lead-name"
            />
            <TextInput
              label="Lead phone"
              value={leadPhone}
              onChange={(event) => setLeadPhone(event.currentTarget.value)}
              required
              data-testid="walk-in-lead-phone"
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
            <TextInput
              label="Lead email (optional)"
              value={leadEmail}
              onChange={(event) => setLeadEmail(event.currentTarget.value)}
              data-testid="walk-in-lead-email"
            />
            <NumberInput
              label="Deposit collected (optional)"
              value={depositRequired}
              onChange={(value) => setDepositRequired(Number(value) || 0)}
              min={0}
              prefix="₹"
              data-testid="walk-in-deposit"
            />
          </SimpleGrid>

          <Divider label="Pick rooms from live availability" labelPosition="left" />

          {isLoadingRooms ? (
            <Text c="#64748b" size="sm">
              Loading available rooms…
            </Text>
          ) : roomsByType.length === 0 ? (
            <Alert color="orange" icon={<AlertTriangle size={16} />}>
              No rooms available for the selected dates. Try different dates or free up rooms in
              housekeeping.
            </Alert>
          ) : (
            <ScrollArea.Autosize mah={280} type="auto">
              <Stack gap={spacing[2]}>
                {roomsByType.map(([typeId, group]) => (
                  <Box key={typeId}>
                    <Group gap={6} mb={4}>
                      <BedDouble size={14} color="#334155" />
                      <Text fw={700} c="#101828" size="sm">
                        {group.name}
                      </Text>
                      <Badge variant="light" color="stayosBrand">
                        {group.rooms.length} available
                      </Badge>
                    </Group>
                    <SimpleGrid cols={{ base: 2, sm: 4, md: 5 }} spacing={6}>
                      {group.rooms.map((room) => {
                        const isSelected = Boolean(assignments[room.roomId]);
                        return (
                          <Card
                            key={room.roomId}
                            padding={8}
                            radius={radius.md}
                            withBorder
                            onClick={() => toggleRoom(room)}
                            style={{
                              background: isSelected ? '#eef2ff' : '#ffffff',
                              borderColor: isSelected ? '#6366f1' : '#e2e8f0',
                              cursor: 'pointer',
                              transition: 'background 120ms ease, border-color 120ms ease',
                            }}
                            data-testid={`walk-in-room-${room.roomNumber}`}
                          >
                            <Group gap={6} wrap="nowrap">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => toggleRoom(room)}
                                onClick={(event) => event.stopPropagation()}
                                aria-label={`Select room ${room.roomNumber}`}
                              />
                              <Text fw={750} c="#101828" size="sm">
                                {room.roomNumber}
                              </Text>
                            </Group>
                          </Card>
                        );
                      })}
                    </SimpleGrid>
                  </Box>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          )}

          {selectedList.length > 0 ? (
            <Stack gap={6}>
              <Text fw={700} c="#101828" size="sm">
                Occupants per room ({selectedList.length} room{selectedList.length > 1 ? 's' : ''} ·{' '}
                {totalAdults} adult{totalAdults !== 1 ? 's' : ''}
                {totalChildren > 0 ? ` · ${totalChildren} children` : ''})
              </Text>
              <Stack gap={4}>
                {selectedList.map((assignment) => {
                  const room = availableRooms.find((r) => r.roomId === assignment.roomId);
                  return (
                    <Group
                      key={assignment.roomId}
                      gap={8}
                      wrap="nowrap"
                      align="flex-end"
                      data-testid={`walk-in-occupant-${room?.roomNumber ?? assignment.roomId}`}
                    >
                      <Badge color="stayosBrand" variant="light" size="lg" style={{ minWidth: 64 }}>
                        {room?.roomNumber ?? '-'}
                      </Badge>
                      <TextInput
                        placeholder="Occupant name (optional)"
                        value={assignment.guestName ?? ''}
                        onChange={(event) =>
                          updateAssignment(assignment.roomId, {
                            guestName: event.currentTarget.value,
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <NumberInput
                        label="Adults"
                        value={assignment.adults}
                        onChange={(value) =>
                          updateAssignment(assignment.roomId, { adults: Number(value) || 1 })
                        }
                        min={1}
                        max={10}
                        w={90}
                      />
                      <NumberInput
                        label="Kids"
                        value={assignment.children}
                        onChange={(value) =>
                          updateAssignment(assignment.roomId, { children: Number(value) || 0 })
                        }
                        min={0}
                        max={10}
                        w={80}
                      />
                    </Group>
                  );
                })}
              </Stack>
            </Stack>
          ) : null}

          <Textarea
            label="Notes (optional)"
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
            minRows={2}
            placeholder="Any special requests or context for this group"
          />

          {error ? (
            <Alert color="red" icon={<AlertTriangle size={16} />}>
              {error}
            </Alert>
          ) : null}

          <Group justify="space-between" mt={spacing[1]}>
            <Text c="#64748b" size="xs">
              A single master folio will be created for the whole group. Rooms will be marked
              occupied immediately.
            </Text>
            <Group gap={8}>
              <Button variant="subtle" color="gray" onClick={onClose} data-testid="walk-in-cancel">
                Cancel
              </Button>
              <Button
                color="stayosBrand"
                onClick={() => void submit()}
                loading={isSaving}
                disabled={!canSubmit}
                data-testid="walk-in-submit"
              >
                Check in group
              </Button>
            </Group>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

export default WalkInGroupModal;
