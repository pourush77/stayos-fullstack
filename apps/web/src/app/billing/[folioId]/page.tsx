'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Box, Card, Group, Skeleton, Stack } from '@mantine/core';
import { ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { spacing } from '@stayos/theme';
import { useAuth } from '../../../features/auth/auth-context';
import { BillingApiError, getFolio } from '../../../features/billing/api/billing-api';
import { FolioPanel } from '../../../features/billing/components/FolioPanel';
import type { Folio } from '../../../features/billing/types/billing.types';

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('*'));
}

function FolioDetailSkeleton() {
  return (
    <Stack gap={spacing[3]} data-testid="folio-detail-skeleton">
      {/* Folio summary */}
      <Card p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={8}>
              <Skeleton height={26} width={230} radius="sm" />
              <Skeleton height={16} width={430} radius="sm" />
            </Stack>

            <Group gap="lg">
              <Stack gap={6}>
                <Skeleton height={12} width={70} radius="sm" />
                <Skeleton height={20} width={80} radius="sm" />
              </Stack>

              <Stack gap={6}>
                <Skeleton height={12} width={50} radius="sm" />
                <Skeleton height={20} width={70} radius="sm" />
              </Stack>

              <Stack gap={6}>
                <Skeleton height={12} width={50} radius="sm" />
                <Skeleton height={20} width={80} radius="sm" />
              </Stack>

              <Stack gap={6}>
                <Skeleton height={12} width={65} radius="sm" />
                <Skeleton height={20} width={80} radius="sm" />
              </Stack>
            </Group>
          </Group>

          <Group gap="sm">
            <Skeleton height={36} width={110} radius="md" />
            <Skeleton height={36} width={110} radius="md" />
            <Skeleton height={36} width={110} radius="md" />
          </Group>
        </Stack>
      </Card>

      {/* Charges */}
      <Card p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Skeleton height={22} width={90} radius="sm" />

          {Array.from({ length: 3 }).map((_, index) => (
            <Group key={`charge-skeleton-${index}`} justify="space-between" wrap="nowrap">
              <Skeleton height={18} width={110} radius="sm" />
              <Skeleton height={18} width="35%" radius="sm" />
              <Skeleton height={18} width={55} radius="sm" />
              <Skeleton height={18} width={80} radius="sm" />
              <Skeleton height={18} width={70} radius="sm" />
              <Skeleton height={18} width={90} radius="sm" />
            </Group>
          ))}
        </Stack>
      </Card>

      {/* Payments */}
      <Card p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Skeleton height={22} width={100} radius="sm" />

          {Array.from({ length: 2 }).map((_, index) => (
            <Group key={`payment-skeleton-${index}`} justify="space-between" wrap="nowrap">
              <Skeleton height={18} width={70} radius="sm" />
              <Skeleton height={18} width={90} radius="sm" />
              <Skeleton height={18} width={120} radius="sm" />
              <Skeleton height={18} width={150} radius="sm" />
              <Skeleton height={18} width={130} radius="sm" />
              <Skeleton height={30} width={65} radius="md" />
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

export default function FolioDetailPage() {
  const params = useParams<{ folioId: string }>();
  const auth = useAuth();

  const propertyId = auth.user?.propertyId;
  const folioId = params?.folioId;

  const role = String(auth.user?.role ?? '').toUpperCase();

  const canView = hasPermission(auth.user?.permissions, 'billing.view');
  const canManage = hasPermission(auth.user?.permissions, 'billing.manage');

  const canRefund = hasPermission(auth.user?.permissions, 'billing.refund');

  const [folio, setFolio] = useState<Folio | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      /*
       * Auth, property and route context may not be available on the
       * very first render. That is still a loading state and must never
       * be presented to the user as "Folio not found".
       */
      if (auth.isBootstrapping || !propertyId || !folioId) {
        return;
      }

      if (!canView) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotFound(false);
      setError(undefined);

      try {
        const next = await getFolio(propertyId, folioId, signal);

        setFolio(next);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }

        setFolio(undefined);

        if (loadError instanceof BillingApiError && loadError.status === 404) {
          setNotFound(true);
          return;
        }

        setError('Unable to load folio. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [auth.isBootstrapping, canView, folioId, propertyId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  /*
   * Billing workspace itself remains restricted.
   *
   * FRONT_DESK users usually arrive here from a reservation, so send
   * them back to that reservation rather than /billing.
   *
   * Manager / Accounts / Owner / Admin users may return to the
   * Billing workspace.
   */
  const isFrontDesk = role === 'FRONT_DESK';

  const backHref =
    isFrontDesk && folio?.reservationId
      ? `/reservations/${folio.reservationId}`
      : isFrontDesk
        ? '/reservations'
        : '/billing';

  const backLabel = isFrontDesk ? 'Back to Booking' : 'Back to Billing';

  const backLink = (
    <Box>
      <Link
        href={backHref}
        style={{
          alignItems: 'center',
          color: '#0f172a',
          display: 'inline-flex',
          fontSize: 13,
          fontWeight: 700,
          gap: 6,
          lineHeight: 1.2,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
        data-testid="folio-back-link"
      >
        <ChevronLeft size={14} />
        <span>{backLabel}</span>
      </Link>
    </Box>
  );

  if (auth.isBootstrapping) {
    return (
      <Stack gap={spacing[3]} data-testid="folio-detail-page">
        {backLink}
        <FolioDetailSkeleton />
      </Stack>
    );
  }

  if (!canView) {
    return (
      <Stack gap={spacing[3]} data-testid="folio-detail-page">
        {backLink}

        <Alert color="red" title="Billing unavailable">
          You do not have permission to view billing.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap={spacing[3]} data-testid="folio-detail-page">
      {backLink}

      {isLoading ? <FolioDetailSkeleton /> : null}

      {!isLoading && error ? (
        <Alert color="red" title="Unable to load folio">
          {error}
        </Alert>
      ) : null}

      {!isLoading && !error && notFound ? (
        <Alert color="yellow" title="Folio not found">
          We could not find this folio for the selected property.
        </Alert>
      ) : null}

      {!isLoading && !error && !notFound && folio && propertyId ? (
        <FolioPanel
          folio={folio}
          propertyId={propertyId}
          canManage={canManage}
          canRefund={canRefund}
          onFolioChanged={setFolio}
        />
      ) : null}
    </Stack>
  );
}
