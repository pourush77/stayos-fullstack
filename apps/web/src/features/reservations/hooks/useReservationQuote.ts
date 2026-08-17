'use client';

import { useEffect, useRef, useState } from 'react';
import {
  quoteReservation,
  type ReservationQuoteDto,
  type ReservationQuoteInput,
} from '../../../lib/reservation-api';

type QuoteArgs = {
  propertyId?: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  childAges?: number[];
  roomTypeId: string;
  ratePlanId?: string;
  /** Skip the request when the caller already knows inputs are invalid. */
  enabled: boolean;
};

type QuoteState = {
  quote: ReservationQuoteDto | null;
  isLoading: boolean;
  error: string | null;
};

const DEBOUNCE_MS = 350;

function friendlyQuoteError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('at most') || normalized.includes('holds at most')) return message;
  if (normalized.includes('child age')) return message;
  if (normalized.includes('departure')) return 'Departure date must be after arrival date.';
  return "We couldn't price this stay right now. Adjust the details and try again.";
}

/**
 * Debounced, abortable backend pricing quote for the individual booking flow.
 * The backend is the single source of truth for rate, child pricing, GST and
 * deposit — this hook never computes money locally.
 */
export function useReservationQuote(args: QuoteArgs): QuoteState {
  const {
    propertyId,
    arrivalDate,
    departureDate,
    adults,
    children,
    childAges,
    roomTypeId,
    ratePlanId,
    enabled,
  } = args;

  const [state, setState] = useState<QuoteState>({ quote: null, isLoading: false, error: null });
  const requestIdRef = useRef(0);

  const shouldQuote =
    enabled &&
    Boolean(propertyId) &&
    Boolean(roomTypeId) &&
    Boolean(arrivalDate) &&
    Boolean(departureDate) &&
    departureDate > arrivalDate &&
    adults >= 1;

  const childAgesKey = (childAges ?? []).join(',');

  useEffect(() => {
    if (!shouldQuote || !propertyId) {
      setState({ quote: null, isLoading: false, error: null });
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    setState((current) => ({ ...current, isLoading: true, error: null }));

    const payload: ReservationQuoteInput = {
      arrivalDate,
      departureDate,
      adults,
      children,
      childAges: children > 0 ? childAges : undefined,
      roomTypeId,
      ratePlanId: ratePlanId || undefined,
    };

    const handle = window.setTimeout(() => {
      void quoteReservation(propertyId, payload, controller.signal)
        .then((quote) => {
          if (requestId !== requestIdRef.current) return;
          setState({ quote, isLoading: false, error: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setState({
            quote: null,
            isLoading: false,
            error: friendlyQuoteError(error instanceof Error ? error.message : ''),
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [
    shouldQuote,
    propertyId,
    arrivalDate,
    departureDate,
    adults,
    children,
    childAgesKey,
    roomTypeId,
    ratePlanId,
  ]);

  return state;
}
