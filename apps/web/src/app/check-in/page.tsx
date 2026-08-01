'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Center, Loader, Stack, Text } from '@mantine/core';

/**
 * Legacy /check-in?reservationId= route.
 * The current check-in workspace lives at /reservations/:id/check-in.
 * We keep this URL alive to preserve old bookmarks and redirect on the client.
 */
export default function LegacyCheckInRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reservationId = searchParams.get('reservationId') ?? searchParams.get('reservation');

  useEffect(() => {
    if (reservationId) {
      router.replace(`/reservations/${reservationId}/check-in`);
    } else {
      router.replace('/reservations');
    }
  }, [reservationId, router]);

  return (
    <Center mih="60vh">
      <Stack align="center" gap={12}>
        <Loader color="stayosBrand" />
        <Text size="sm" c="#64748b">Redirecting to Check-in Workspace…</Text>
      </Stack>
    </Center>
  );
}
