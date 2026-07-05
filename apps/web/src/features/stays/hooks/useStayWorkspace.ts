'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  checkOutReservation,
  getProperties,
  type ReservationPropertyDto,
} from '../../../lib/reservation-api';
import { getStayWorkspace } from '../api/stay-api';
import { mapStayWorkspace } from '../mappers/stay-mapper';
import type { Stay } from '../types/stay.types';

type StayWorkspaceState = {
  activePropertyName?: string;
  error?: string;
  isLoading: boolean;
  propertyId?: string;
  stay?: Stay;
};

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function isActiveRecord(record: Record<string, unknown>) {
  return getString(record, ['status'], 'ACTIVE').toUpperCase() === 'ACTIVE';
}

async function getCurrentProperty(signal?: AbortSignal) {
  const properties = await getProperties(signal);
  const activeProperty = properties.find(isActiveRecord);
  const propertyId = activeProperty
    ? getString(activeProperty as ReservationPropertyDto, ['id', '_id', 'uuid', 'propertyId'])
    : '';

  if (!activeProperty || !propertyId) {
    throw new Error('No active property returned from properties API.');
  }

  return {
    propertyId,
    propertyName: getString(activeProperty as ReservationPropertyDto, ['name', 'title', 'displayName']),
  };
}

export function useStayWorkspace({
  enabled,
  stayId,
}: {
  enabled: boolean;
  stayId?: string;
}): StayWorkspaceState & {
  checkOutStay: () => Promise<void>;
  refreshStay: () => Promise<void>;
} {
  const [state, setState] = useState<StayWorkspaceState>({ isLoading: true });

  const loadStay = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled || !stayId) {
        setState({ isLoading: false });
        return;
      }

      setState((current) => ({ ...current, error: undefined, isLoading: !current.stay }));

      try {
        const { propertyId, propertyName } = await getCurrentProperty(signal);
        const workspace = await getStayWorkspace(propertyId, stayId, signal);

        setState({
          activePropertyName: propertyName,
          isLoading: false,
          propertyId,
          stay: mapStayWorkspace(workspace),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({
          error: error instanceof Error ? error.message : 'Stay workspace is temporarily unavailable.',
          isLoading: false,
          stay: undefined,
        });
      }
    },
    [enabled, stayId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadStay(controller.signal);
    return () => controller.abort();
  }, [loadStay]);

  const checkOutStay = useCallback(async () => {
    if (!stayId) throw new Error('Stay missing.');
    const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
    await checkOutReservation(propertyId, stayId);
    await loadStay();
  }, [loadStay, state.propertyId, stayId]);

  return {
    ...state,
    checkOutStay,
    refreshStay: useCallback(() => loadStay(), [loadStay]),
  };
}
