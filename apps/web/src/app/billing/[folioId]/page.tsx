'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Box, Stack } from '@mantine/core';
import { ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { spacing } from '@stayos/theme';
import { useAuth } from '../../../features/auth/auth-context';
import { getFolio } from '../../../features/billing/api/billing-api';
import { FolioPanel } from '../../../features/billing/components/FolioPanel';
import type { Folio } from '../../../features/billing/types/billing.types';

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

export default function FolioDetailPage() {
  const params = useParams<{ folioId: string }>();
  const auth = useAuth();
  const propertyId = auth.user?.propertyId;
  const canView = hasPermission(auth.user?.permissions, 'billing.view');
  const canManage = hasPermission(auth.user?.permissions, 'billing.manage');

  const [folio, setFolio] = useState<Folio | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!canView || !propertyId || !params?.folioId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(undefined);
      try {
        const next = await getFolio(propertyId, params.folioId, signal);
        setFolio(next);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError('Unable to load folio.');
      } finally {
        setIsLoading(false);
      }
    },
    [canView, propertyId, params?.folioId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (!canView) {
    return (
      <Alert color="red" title="Billing unavailable">
        You do not have permission to view billing.
      </Alert>
    );
  }

  return (
    <Stack gap={spacing[3]} data-testid="folio-detail-page">
      <Box>
        <Link
          href="/billing"
          style={{ textDecoration: 'none', color: '#0f172a', fontWeight: 700, fontSize: 13 }}
          data-testid="back-to-billing"
        >
          <ChevronLeft size={14} style={{ verticalAlign: 'middle' }} /> Back to Billing
        </Link>
      </Box>

      {isLoading ? <Alert color="blue">Loading folio...</Alert> : null}
      {error ? <Alert color="red">{error}</Alert> : null}
      {!isLoading && !error && !folio ? (
        <Alert color="yellow">Folio not found.</Alert>
      ) : null}

      {folio && propertyId ? (
        <FolioPanel
          folio={folio}
          propertyId={propertyId}
          canManage={canManage}
          onFolioChanged={setFolio}
        />
      ) : null}
    </Stack>
  );
}
