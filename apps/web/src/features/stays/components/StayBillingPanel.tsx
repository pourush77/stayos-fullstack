'use client';

import { Alert, Loader, Stack, Text } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { spacing } from '@stayos/theme';
import { getFolioForReservation, friendlyBillingError } from '../../billing/api/billing-api';
import { FolioPanel } from '../../billing/components/FolioPanel';
import type { Folio } from '../../billing/types/billing.types';

type Props = {
  canView: boolean;
  canManage: boolean;
  propertyId: string;
  reservationId: string;
};

export function StayBillingPanel({
  canView,
  canManage,
  propertyId,
  reservationId,
}: Props) {
  const [folio, setFolio] = useState<Folio | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!canView || !propertyId || !reservationId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(undefined);
      try {
        const next = await getFolioForReservation(propertyId, reservationId, signal);
        setFolio(next);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(friendlyBillingError(loadError));
      } finally {
        setIsLoading(false);
      }
    },
    [canView, propertyId, reservationId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (!canView) {
    return (
      <Text c="#94a3b8" size="sm">
        You do not have permission to view billing for this stay.
      </Text>
    );
  }

  if (isLoading) {
    return (
      <Stack align="center" gap={8}>
        <Loader size="sm" />
        <Text c="#64748b" size="sm">
          Loading folio...
        </Text>
      </Stack>
    );
  }

  if (error) {
    return <Alert color="red">{error}</Alert>;
  }

  if (!folio) {
    return <Text c="#64748b">No folio for this stay yet.</Text>;
  }

  return (
    <Stack gap={spacing[3]}>
      <FolioPanel
        folio={folio}
        propertyId={propertyId}
        canManage={canManage}
        onFolioChanged={setFolio}
        compact
      />
    </Stack>
  );
}
