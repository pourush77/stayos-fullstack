'use client';

import { Alert, Badge, Box, Button, Card, Group, MultiSelect, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { CheckCircle2, ListChecks } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { radius, spacing } from '@stayos/theme';
import {
  getProperties,
  getPropertyAmenities,
  getPropertyRoomTypes,
  setRoomTypeAmenities,
  type InventoryAmenityDto,
  type InventoryPropertyDto,
  type InventoryRoomTypeDto,
} from '../../../lib/inventory-api';
import { useAuth } from '../../../features/auth/auth-context';

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function getBoolean(record: Record<string, unknown>, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
  }
  return fallback;
}

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function activeProperty(properties: InventoryPropertyDto[]) {
  return properties.find((property) => getString(property, ['status'], 'ACTIVE').toUpperCase() === 'ACTIVE');
}

export default function RoomTypeAmenitiesPage() {
  const auth = useAuth();
  const canManage = hasPermission(auth.user?.permissions, 'rooms.manage');
  const [propertyId, setPropertyId] = useState(auth.user?.propertyId ?? '');
  const [amenities, setAmenities] = useState<InventoryAmenityDto[]>([]);
  const [roomTypes, setRoomTypes] = useState<InventoryRoomTypeDto[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState<string>();
  const [error, setError] = useState<string>();

  const amenityOptions = useMemo(
    () => amenities
      .filter((amenity) => getBoolean(amenity, ['isActive', 'is_active'], true))
      .map((amenity) => ({ label: getString(amenity, ['label', 'code']), value: getString(amenity, ['id']) }))
      .filter((option) => option.value),
    [amenities],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setError(undefined);
        const resolvedPropertyId = propertyId || getString(activeProperty(await getProperties(controller.signal)), ['id']);
        if (!resolvedPropertyId) throw new Error('No active property returned.');
        setPropertyId(resolvedPropertyId);
        const [nextAmenities, nextRoomTypes] = await Promise.all([
          getPropertyAmenities(resolvedPropertyId, controller.signal),
          getPropertyRoomTypes(resolvedPropertyId, controller.signal),
        ]);
        setAmenities(nextAmenities);
        setRoomTypes(nextRoomTypes);
        setSelected(Object.fromEntries(nextRoomTypes.map((roomType) => [
          getString(roomType, ['id']),
          (Array.isArray(roomType.amenities) ? roomType.amenities : [])
            .map((amenity) => getString(amenity as Record<string, unknown>, ['id']))
            .filter(Boolean),
        ])));
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError('Unable to load room type amenities.');
      }
    }

    void load();
    return () => controller.abort();
  }, [propertyId]);

  if (!canManage) {
    return <Alert color="red" variant="light" radius={radius.lg}>You do not have permission to manage room amenities.</Alert>;
  }

  return (
    <Stack gap={spacing[4]}>
      <Box>
        <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 750 }}>Room Type Amenities</Title>
        <Text c="#64748b" mt={4} style={{ fontSize: 14 }}>Assign amenity badges that rooms inherit from their room type.</Text>
      </Box>

      {error ? <Alert color="red" variant="light" radius={radius.lg}>{error}</Alert> : null}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={spacing[3]}>
        {roomTypes.map((roomType) => {
          const id = getString(roomType, ['id']);
          return (
            <Card key={id} radius={radius.lg} p={20} style={{ border: '1px solid rgba(226, 232, 240, 0.9)' }}>
              <Group justify="space-between" align="flex-start">
                <Group gap={12}>
                  <ListChecks size={22} color="#4f46e5" />
                  <Box>
                    <Text c="#101828" fw={800}>{getString(roomType, ['name'], 'Room Type')}</Text>
                    <Text c="#64748b" size="sm">{getString(roomType, ['code'])}</Text>
                  </Box>
                </Group>
                <Badge radius={radius.full} variant="light" color="gray">
                  {(selected[id] ?? []).length} amenities
                </Badge>
              </Group>
              <MultiSelect
                mt={spacing[4]}
                data={amenityOptions}
                searchable
                clearable
                placeholder="Select amenities"
                value={selected[id] ?? []}
                onChange={(value) => setSelected((current) => ({ ...current, [id]: value }))}
              />
              <Group justify="flex-end" mt={spacing[4]}>
                <Button
                  color="stayosBrand"
                  leftSection={<CheckCircle2 size={16} />}
                  loading={saving === id}
                  onClick={() => {
                    setSaving(id);
                    void setRoomTypeAmenities(propertyId, id, selected[id] ?? [])
                      .then((updated) => {
                        setRoomTypes((current) => current.map((item) => getString(item, ['id']) === id ? updated : item));
                      })
                      .catch(() => setError('Unable to save room type amenities.'))
                      .finally(() => setSaving(undefined));
                  }}
                >
                  Save
                </Button>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
