'use client';

import Link from 'next/link';
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Badge, Box, Button, Card, Checkbox, Group, Loader, Paper, Select, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { AlertTriangle, BedDouble, Camera, Check, ChevronLeft, Clock3, CreditCard, IdCard, Info, ShieldCheck, Sparkles, Trash2, Upload, UserRound, Users, X } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { useAuth } from '../auth/auth-context';
import {
  checkInReservation,
  deleteCheckInDocument,
  getCheckInDocumentPreviewUrl,
  getCheckInWorkspace,
  reviewCheckInPayment,
  updateGuestRegistration,
  updateIdentityVerification,
  uploadCheckInDocument,
  type CheckInWorkspaceDto,
} from '../../lib/reservation-api';
import { detectIdFromImage, type IdDetectionResult } from './utils/id-detection';
import { FaceMatchCard } from './components/FaceMatchCard';
import { SendToPhoneModal } from './components/SendToPhoneModal';
import { CheckoutModal } from './components/CheckoutModal';
import { COMMON_COUNTRIES, COMMON_NATIONALITIES, INDIAN_STATES, PURPOSE_OF_VISIT } from './constants/guest-form-options';
import styles from './CheckInWorkspacePage.module.css';

type CheckInWizardStep = 'identity' | 'guest' | 'payment' | 'room';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};


function idTypeLabel(type: string): string {
  switch (type) {
    case 'AADHAAR': return 'Aadhaar';
    case 'PASSPORT': return 'Passport';
    case 'DRIVING_LICENSE': return 'Driving License';
    case 'VOTER_ID': return 'Voter ID';
    case 'PAN': return 'PAN';
    default: return 'ID';
  }
}

function normalizeIdNumber(type: string, value: string) {
  if (type === 'AADHAAR') return value.replace(/\D/g, '').slice(0, 12);
  if (type === 'PAN') return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (type === 'VOTER_ID') return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (type === 'PASSPORT') return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9);
  if (type === 'DRIVING_LICENSE') return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  return value.trimStart().slice(0, 80);
}

function idNumberRule(type: string) {
  switch (type) {
    case 'AADHAAR':
      return {
        hint: 'Enter exactly 12 digits. Example: 1234 5678 9012.',
        maxLength: 12,
        pattern: /^\d{12}$/,
      };
    case 'PAN':
      return {
        hint: 'Enter 10 characters. Format: ABCDE1234F.',
        maxLength: 10,
        pattern: /^[A-Z]{5}\d{4}[A-Z]$/,
      };
    case 'VOTER_ID':
      return {
        hint: 'Enter 10 letters/numbers from the voter ID.',
        maxLength: 10,
        pattern: /^[A-Z0-9]{10}$/,
      };
    case 'PASSPORT':
      return {
        hint: 'Enter 8 to 9 letters/numbers from the passport.',
        maxLength: 9,
        pattern: /^[A-Z0-9]{8,9}$/,
      };
    case 'DRIVING_LICENSE':
      return {
        hint: 'Enter up to 16 letters/numbers from the driving license.',
        maxLength: 16,
        pattern: /^[A-Z0-9]{8,16}$/,
      };
    default:
      return {
        hint: 'Enter the ID number shown on the document.',
        maxLength: 80,
        pattern: /^.{3,80}$/,
      };
  }
}

// Common cities per Indian state - used as placeholder suggestion for the city field.
const STATE_HINT_CITY: Record<string, string> = {
  'Madhya Pradesh': 'Indore',
  'Maharashtra': 'Mumbai',
  'Karnataka': 'Bengaluru',
  'Tamil Nadu': 'Chennai',
  'Delhi': 'New Delhi',
  'Rajasthan': 'Jaipur',
  'Gujarat': 'Ahmedabad',
  'Uttar Pradesh': 'Lucknow',
  'West Bengal': 'Kolkata',
  'Kerala': 'Kochi',
  'Punjab': 'Chandigarh',
  'Haryana': 'Gurugram',
  'Telangana': 'Hyderabad',
  'Andhra Pradesh': 'Visakhapatnam',
  'Bihar': 'Patna',
  'Odisha': 'Bhubaneswar',
  'Chhattisgarh': 'Raipur',
  'Jharkhand': 'Ranchi',
  'Assam': 'Guwahati',
  'Goa': 'Panaji',
  'Uttarakhand': 'Dehradun',
  'Himachal Pradesh': 'Shimla',
};

function cityPlaceholder(state: string): string {
  return `e.g. ${STATE_HINT_CITY[state] ?? 'Indore'}`;
}

function normalizeNationality(value?: string | null): string {
  return value?.trim() ? value.trim().toUpperCase() : 'INDIAN';
}

function computeNights(arrival: string, departure: string): number {
  const a = new Date(arrival + 'T00:00:00');
  const d = new Date(departure + 'T00:00:00');
  const diff = Math.round((d.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  return diff > 0 ? diff : 1;
}

function recommendedWizardStep(checklist: CheckInWorkspaceDto['finalChecklist']): CheckInWizardStep {
  if (!checklist.identityVerified) return 'identity';
  if (!checklist.guestRegistrationComplete) return 'guest';
  if (!checklist.roomReady) return 'room';
  if (!checklist.paymentReviewed) return 'payment';
  return 'identity';
}

const BLOCKER_MESSAGES: Record<string, string> = {
  CHECKIN_GUEST_REGISTRATION_INCOMPLETE: 'Guest registration is incomplete. Fill address, city, state, country, purpose of visit and mobile.',
  CHECKIN_IDENTITY_NOT_VERIFIED: 'Identity is not verified. Record the ID type + number and mark it verified.',
  CHECKIN_PAYMENT_NOT_REVIEWED: 'Payment has not been reviewed. Confirm the payment method or that dues are settled.',
  CHECKIN_ROOM_NOT_READY: 'Room is not ready. Ask housekeeping to mark it Ready.',
  CHECKIN_ROOM_UNAVAILABLE: 'No room is assigned to this booking. Assign one from the booking page.',
  CHECKIN_ALREADY_CHECKED_IN: 'This guest is already checked in.',
};

function ChecklistPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Group gap={6} wrap="nowrap" p={8} style={{ background: ok ? '#ecfdf3' : '#fef2f2', border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`, borderRadius: radius.md }}>
      <ThemeIcon color={ok ? 'green' : 'red'} radius="xl" size={20} variant="filled">
        {ok ? <Check size={12} /> : <X size={12} />}
      </ThemeIcon>
      <Text c={ok ? '#166534' : '#991b1b'} fw={700} size="xs">{label}</Text>
    </Group>
  );
}

function StepCard({ icon, title, complete, children }: { icon: React.ReactNode; title: string; complete: boolean; children: React.ReactNode }) {
  return (
    <Card
      radius={radius.lg}
      p={20}
      style={{
        ...cardStyle,
        border: complete ? '1px solid rgba(34,197,94,0.22)' : '1px solid rgba(226,232,240,0.78)',
        boxShadow: '0 16px 40px rgba(15,23,42,0.045)',
      }}
    >
      <Group justify="space-between" align="center" mb={12}>
        <Group gap={10}>
          <ThemeIcon
            color={complete ? 'green' : 'stayosBrand'}
            variant="light"
            radius={radius.md}
            size={38}
            style={{ boxShadow: complete ? '0 8px 18px rgba(34,197,94,0.12)' : '0 8px 18px rgba(125,77,214,0.12)' }}
          >
            {icon}
          </ThemeIcon>
          <Title order={2} c="#101828" style={{ fontSize: 18, fontWeight: 800 }}>{title}</Title>
        </Group>
        <Badge color={complete ? 'green' : 'gray'} variant="light" size="sm">{complete ? 'Complete' : 'Pending'}</Badge>
      </Group>
      {children}
    </Card>
  );
}

function IdPhotoTile({
  side,
  label,
  document,
  propertyId,
  reservationId,
  onUpload,
  onDelete,
  uploading,
}: {
  side: 'front' | 'back';
  label: string;
  document?: { id: string; mimeType: string; originalFilename: string };
  propertyId: string;
  reservationId: string;
  onUpload: (side: 'front' | 'back', file: File) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!document) {
      setPreviewUrl(undefined);
      return;
    }
    let cancelled = false;
    let objectUrl: string | undefined;
    setPreviewLoading(true);
    (async () => {
      try {
        const url = getCheckInDocumentPreviewUrl(propertyId, reservationId, document.id);
        const response = await fetch(url);
        if (!response.ok) throw new Error('preview failed');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) setPreviewUrl(undefined);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document, propertyId, reservationId]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast({ color: 'red', title: 'File too large', message: 'Please pick an image under 10 MB.' });
      return;
    }
    await onUpload(side, file);
  };

  const hasImage = Boolean(document && previewUrl);
  const isPdf = document?.mimeType === 'application/pdf';

  return (
    <Paper
      radius={radius.md}
      p={12}
      style={{
        background: hasImage || isPdf ? '#ffffff' : 'linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)',
        border: `1px dashed ${hasImage || isPdf ? 'rgba(125,77,214,0.55)' : 'rgba(148,163,184,0.42)'}`,
        boxShadow: hasImage || isPdf ? '0 10px 24px rgba(125,77,214,0.06)' : 'inset 0 1px 0 rgba(255,255,255,0.9)',
        minHeight: 152,
      }}
      data-testid={`id-photo-tile-${side}`}
    >
      <Stack gap={8} align="center" justify="center" style={{ minHeight: 128 }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          capture={side === 'front' ? 'environment' : undefined}
          onChange={(e) => void handleFile(e)}
          style={{ display: 'none' }}
          data-testid={`id-photo-input-${side}`}
        />
        {previewLoading ? (
          <Loader size="sm" color="stayosBrand" />
        ) : hasImage ? (
          <Box
            component="img"
            src={previewUrl}
            alt={`${label} preview`}
            style={{
              maxHeight: 96,
              maxWidth: '100%',
              objectFit: 'contain',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          />
        ) : isPdf ? (
          <Stack align="center" gap={4}>
            <ThemeIcon color="stayosBrand" variant="light" size={40}><IdCard size={20} /></ThemeIcon>
            <Text size="xs" c="#64748b" ta="center" lineClamp={1}>{document?.originalFilename ?? 'PDF uploaded'}</Text>
          </Stack>
        ) : (
          <Stack align="center" gap={4}>
            <ThemeIcon color="stayosBrand" variant="light" size={44}>
              <Camera size={22} />
            </ThemeIcon>
            <Text fw={700} size="sm" c="#101828">{label}</Text>
            <Text size="xs" c="#64748b">Tap to snap or upload</Text>
          </Stack>
        )}
        <Group gap={6} mt={4}>
          <Button
            variant="light"
            color="stayosBrand"
            size="xs"
            leftSection={hasImage || isPdf ? <Upload size={14} /> : <Camera size={14} />}
            loading={uploading}
            onClick={() => inputRef.current?.click()}
            data-testid={`id-photo-upload-${side}`}
          >
            {hasImage || isPdf ? 'Replace' : 'Snap / Upload'}
          </Button>
          {document ? (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              leftSection={<Trash2 size={14} />}
              onClick={() => void onDelete(document.id)}
              data-testid={`id-photo-delete-${side}`}
            >
              Remove
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Paper>
  );
}

export function CheckInWorkspacePage() {
  const params = useParams<{ reservationId: string }>();
  const router = useRouter();
  const auth = useAuth();
  const propertyId = auth.user?.propertyId ?? '';
  const [workspace, setWorkspace] = useState<CheckInWorkspaceDto | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState<'guest' | 'identity' | 'payment' | 'complete' | 'id-front' | 'id-back' | 'id-delete' | null>(null);

  // Guest form state
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState<string>('INDIAN');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState<string>('');
  const [country, setCountry] = useState<string>('India');
  const [purposeOfVisit, setPurposeOfVisit] = useState<string>('Leisure');
  // Track which fields were just auto-filled from OCR so we can flag them in the UI.
  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({});

  // Identity form state
  const [idType, setIdType] = useState<string>('AADHAAR');
  const [idNumber, setIdNumber] = useState('');
  const [idVerified, setIdVerified] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [idFrontPreviewUrl, setIdFrontPreviewUrl] = useState<string | undefined>(undefined);
  const [guestFacePreviewUrl, setGuestFacePreviewUrl] = useState<string | undefined>(undefined);
  const [sendToPhoneOpened, setSendToPhoneOpened] = useState(false);

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentCollectionOpened, setPaymentCollectionOpened] = useState(false);
  const [activeStep, setActiveStep] = useState<CheckInWizardStep>('identity');
  const [savedStep, setSavedStep] = useState<CheckInWizardStep | null>(null);
  const [cameraSkipped, setCameraSkipped] = useState(false);
  const [showAllGuestDetails, setShowAllGuestDetails] = useState(false);

  const flashSavedStep = (step: CheckInWizardStep) => {
    setSavedStep(step);
    window.setTimeout(() => setSavedStep((current) => (current === step ? null : current)), 1800);
  };

  useEffect(() => {
    if (!workspace) return;
    if (activeStep === 'guest') setShowAllGuestDetails(false);
    const handle = window.setTimeout(() => {
      const activePanel = document.querySelector(`[data-checkin-step="${activeStep}"]`);
      const firstInput = activePanel?.querySelector<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>(
        'input:not([type="hidden"]):not(:disabled), button:not(:disabled), select:not(:disabled)',
      );
      firstInput?.focus();
    }, 80);
    return () => window.clearTimeout(handle);
  }, [activeStep, workspace?.booking.reservationId]);

  const applyWorkspace = useCallback((next: CheckInWorkspaceDto, options?: { keepStep?: boolean }) => {
    setWorkspace(next);
    if (!options?.keepStep) setActiveStep(recommendedWizardStep(next.finalChecklist));
    setFullName(next.guest.fullName ?? '');
    setMobile(next.guest.mobile ?? '');
    setEmail(next.guest.email ?? '');
    setNationality(normalizeNationality(next.guest.nationality));
    setDateOfBirth(next.guest.dateOfBirth ? next.guest.dateOfBirth.slice(0, 10) : '');
    setAddressLine1(next.guest.address ?? '');
    setCity(next.guest.city ?? '');
    setState(next.guest.state ?? '');
    setCountry(next.guest.country ?? 'India');
    setPurposeOfVisit(next.guest.purposeOfVisit ?? 'Leisure');
    if (next.identity.idType) setIdType(next.identity.idType);
    setIdVerified(next.identity.verified);
    if (next.payment.paymentMethod) setPaymentMethod(next.payment.paymentMethod);
  }, []);

  const applyDetectedId = useCallback((detected: IdDetectionResult | null) => {
    if (!detected) return false;
    const bits: string[] = [];
    const flags: Record<string, boolean> = {};

    if (detected.idType !== 'OTHER') {
      setIdType(detected.idType);
      if (detected.idNumber) {
        setIdNumber(normalizeIdNumber(detected.idType, detected.idNumber));
        flags.idNumber = true;
        bits.push(`${detected.idType.replace('_', ' ')}: ${detected.idNumber}`);
      } else {
        bits.push(detected.idType.replace('_', ' '));
      }
    }
    if (detected.fullName && !fullName.trim()) {
      setFullName(detected.fullName);
      flags.fullName = true;
      bits.push(`Name: ${detected.fullName}`);
    } else if (detected.fullName && detected.fullName.toLowerCase() !== fullName.trim().toLowerCase()) {
      bits.push(`ID name: ${detected.fullName}`);
    }
    if (detected.dateOfBirth && !dateOfBirth.trim()) {
      setDateOfBirth(detected.dateOfBirth);
      flags.dateOfBirth = true;
      bits.push(`DOB: ${detected.dateOfBirth}`);
    }
    if (detected.address && !addressLine1.trim()) {
      setAddressLine1(detected.address);
      flags.addressLine1 = true;
      bits.push('Address');
    }
    if (detected.country && !country.trim()) {
      setCountry(detected.country);
      flags.country = true;
    }
    if (detected.state && !state.trim()) {
      setState(detected.state);
      flags.state = true;
    }
    if (detected.city && !city.trim()) {
      setCity(detected.city);
      flags.city = true;
    }
    if (Object.keys(flags).length > 0) {
      setAutoFilled((prev) => ({ ...prev, ...flags }));
    }
    if (bits.length === 0) return false;
    showToast({
      color: 'green',
      title: 'Auto-filled from ID',
      message: `${bits.join(' - ')} - please confirm and save.`,
    });
    return true;
  }, [addressLine1, city, country, dateOfBirth, fullName, state]);

  useEffect(() => {
    if (!params.reservationId || !propertyId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const ws = await getCheckInWorkspace(propertyId, params.reservationId, controller.signal);
        applyWorkspace(ws);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load check-in workspace.');
      }
    })();
    return () => controller.abort();
  }, [params.reservationId, propertyId, applyWorkspace]);

  // Fetch the ID front preview as a blob URL so it can be rendered next to the guest webcam snap.
  const idFrontDocId = workspace?.documents.find((d) => d.side === 'ID_FRONT')?.id;
  useEffect(() => {
    if (!propertyId || !workspace?.booking.reservationId || !idFrontDocId) {
      setIdFrontPreviewUrl(undefined);
      return;
    }
    let cancelled = false;
    let objectUrl: string | undefined;
    (async () => {
      try {
        const url = getCheckInDocumentPreviewUrl(propertyId, workspace.booking.reservationId, idFrontDocId);
        const response = await fetch(url);
        if (!response.ok) throw new Error('preview failed');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setIdFrontPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) setIdFrontPreviewUrl(undefined);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [propertyId, workspace?.booking.reservationId, idFrontDocId]);

  // Persisted guest-face snap (rendered in the GUEST tile of the face-match card).
  const guestFaceDocId = workspace?.documents.find((d) => d.side === 'GUEST_FACE')?.id;
  useEffect(() => {
    if (!propertyId || !workspace?.booking.reservationId || !guestFaceDocId) {
      setGuestFacePreviewUrl(undefined);
      return;
    }
    let cancelled = false;
    let objectUrl: string | undefined;
    (async () => {
      try {
        const url = getCheckInDocumentPreviewUrl(propertyId, workspace.booking.reservationId, guestFaceDocId);
        const response = await fetch(url);
        if (!response.ok) throw new Error('preview failed');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setGuestFacePreviewUrl(objectUrl);
      } catch {
        if (!cancelled) setGuestFacePreviewUrl(undefined);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [propertyId, workspace?.booking.reservationId, guestFaceDocId]);

  // Manual workspace reload - used after phone uploads or face-snap persistence completes.
  const refreshWorkspace = useCallback(() => {
    if (!propertyId || !params.reservationId) return;
    void getCheckInWorkspace(propertyId, params.reservationId)
      .then((next) => applyWorkspace(next, { keepStep: true }))
      .catch(() => undefined);
  }, [propertyId, params.reservationId, applyWorkspace]);

  if (loadError) {
    return (
      <Stack gap={spacing[3]}>
        <Alert color="red" variant="light" icon={<AlertTriangle size={17} />}>{loadError}</Alert>
        <Group gap={8}>
          <Button component={Link} href={`/reservations/${params.reservationId}`} variant="light" color="stayosBrand" leftSection={<ChevronLeft size={16} />}>Back to booking</Button>
          <Button component={Link} href="/" variant="light" color="gray" leftSection={<ChevronLeft size={16} />}>Back to Front Desk</Button>
        </Group>
      </Stack>
    );
  }

  if (!workspace) {
    return <Alert color="blue" variant="light">Loading check-in workspace...</Alert>;
  }

  const saveGuestRegistration = async () => {
    if (!propertyId) return;
    setIsSubmitting('guest');
    try {
      const next = await updateGuestRegistration(propertyId, workspace.booking.reservationId, {
        fullName: fullName.trim(),
        mobile: mobile.trim() || undefined,
        email: email.trim() || undefined,
        nationality: nationality.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        country: country.trim() || undefined,
        purposeOfVisit: purposeOfVisit.trim() || undefined,
      });
      applyWorkspace(next, { keepStep: true });
      setActiveStep(next.finalChecklist.paymentReviewed ? 'room' : 'payment');
      flashSavedStep('guest');
      showToast({ color: 'green', title: 'Guest details saved', message: 'Registration updated.' });
    } catch (error) {
      showToast({ color: 'red', title: 'Save failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSubmitting(null);
    }
  };

  const saveIdentity = async () => {
    if (!propertyId) return;
    const nextIdNumber = normalizeIdNumber(idType, idNumber);
    if (!nextIdNumber && !workspace.identity.idNumberMasked) {
      showToast({ color: 'red', title: 'ID number required', message: 'Enter the ID number to save.' });
      return;
    }
    if (nextIdNumber && !idNumberRule(idType).pattern.test(nextIdNumber)) {
      showToast({ color: 'red', title: 'Invalid ID number', message: idNumberRule(idType).hint });
      return;
    }
    if (!idVerified) {
      showToast({ color: 'yellow', title: 'Verify physically', message: 'Confirm the ID matches the guest before saving.' });
      return;
    }
    setIsSubmitting('identity');
    try {
      const next = await updateIdentityVerification(propertyId, workspace.booking.reservationId, {
        idType,
        idNumber: nextIdNumber || workspace.identity.idNumberMasked || '',
        verified: idVerified,
      });
      applyWorkspace(next, { keepStep: true });
      setActiveStep(next.finalChecklist.guestRegistrationComplete ? (next.finalChecklist.paymentReviewed ? 'room' : 'payment') : 'guest');
      flashSavedStep('identity');
      setIdNumber('');
      showToast({ color: 'green', title: 'Identity saved', message: idVerified ? 'Marked verified.' : 'Details saved (not yet verified).' });
    } catch (error) {
      showToast({ color: 'red', title: 'Save failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSubmitting(null);
    }
  };

  const uploadIdPhoto = async (side: 'front' | 'back', file: File) => {
    if (!propertyId) return;
    setIsSubmitting(side === 'front' ? 'id-front' : 'id-back');
    try {
      await uploadCheckInDocument(propertyId, workspace.booking.reservationId, side, file);
      const next = await getCheckInWorkspace(propertyId, workspace.booking.reservationId);
      applyWorkspace(next, { keepStep: true });
      showToast({ color: 'green', title: 'Photo uploaded', message: `${side === 'front' ? 'Front' : 'Back'} of ID saved.` });

      // Auto-detect ID type + number + name from the front photo (client-side OCR - Tesseract.js).
      if (file.type.startsWith('image/')) {
        try {
          setIsDetecting(true);
          const detected = await detectIdFromImage(file);
          if (detected) {
            if (applyDetectedId(detected)) return;
            const bits: string[] = [];
            const flags: Record<string, boolean> = {};
            if (detected.idType !== 'OTHER' && detected.idNumber) {
              setIdType(detected.idType);
              setIdNumber(normalizeIdNumber(detected.idType, detected.idNumber));
              flags.idNumber = true;
              bits.push(`${detected.idType.replace('_', ' ')}: ${detected.idNumber}`);
            }
            if (detected.fullName && !fullName.trim()) {
              // Only auto-fill the guest name if the receptionist hasn't already picked or typed one.
              setFullName(detected.fullName);
              flags.fullName = true;
              bits.push(`Name: ${detected.fullName}`);
            } else if (detected.fullName && detected.fullName.toLowerCase() !== fullName.trim().toLowerCase()) {
              // Guest already has a name - don't overwrite, just surface the detected one so front desk can compare.
              bits.push(`ID name: ${detected.fullName}`);
            }
            if (detected.dateOfBirth && !dateOfBirth.trim()) {
              setDateOfBirth(detected.dateOfBirth);
              flags.dateOfBirth = true;
              bits.push(`DOB: ${detected.dateOfBirth}`);
            }
            if (Object.keys(flags).length > 0) {
              setAutoFilled((prev) => ({ ...prev, ...flags }));
            }
            if (bits.length > 0) {
              showToast({
                color: 'green',
                title: 'Auto-filled from ID',
                message: `${bits.join(' · ')} - please confirm and save.`,
              });
            } else {
              showToast({
                color: 'yellow',
                title: 'Could not read ID clearly',
                message: 'The photo looks blurry / not an ID. Try a well-lit, close-up snap in daylight, or type the ID number manually below.',
                autoClose: 8000,
              });
            }
          }
        } catch (ocrError) {
          console.warn('OCR failed', ocrError);
          showToast({
            color: 'yellow',
            title: 'OCR could not read this photo',
            message: 'Continue manually, or upload a closer, straight photo where the ID text fills most of the frame.',
            autoClose: 8000,
          });
        } finally {
          setIsDetecting(false);
        }
      }
    } catch (error) {
      showToast({ color: 'red', title: 'Upload failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSubmitting(null);
    }
  };

  const tryAutoFillFromId = async () => {
    if (!propertyId || !workspace) return;
    const docsToRead = workspace.documents.filter((doc) =>
      (doc.side === 'ID_FRONT' || doc.side === 'ID_BACK') && doc.mimeType.startsWith('image/'),
    );
    if (docsToRead.length === 0) {
      showToast({
        color: 'yellow',
        title: 'Upload ID photos first',
        message: 'Add the front and back photos, then try auto-fill.',
      });
      return;
    }

    setIsDetecting(true);
    let filledAny = false;
    try {
      for (const doc of docsToRead) {
        const response = await fetch(getCheckInDocumentPreviewUrl(propertyId, workspace.booking.reservationId, doc.id));
        if (!response.ok) continue;
        const blob = await response.blob();
        const detected = await detectIdFromImage(blob);
        filledAny = applyDetectedId(detected) || filledAny;
      }
      if (!filledAny) {
        showToast({
          color: 'yellow',
          title: 'Could not auto-fill from ID',
          message: 'Type the fields manually, or upload a closer, straight photo where the text fills most of the frame.',
          autoClose: 8000,
        });
      }
    } catch (ocrError) {
      console.warn('OCR failed', ocrError);
      showToast({
        color: 'yellow',
        title: 'OCR could not read this photo',
        message: 'Continue manually. OCR is optional and should not block check-in.',
        autoClose: 8000,
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const deleteIdPhoto = async (documentId: string) => {
    if (!propertyId) return;
    setIsSubmitting('id-delete');
    try {
      await deleteCheckInDocument(propertyId, workspace.booking.reservationId, documentId);
      const next = await getCheckInWorkspace(propertyId, workspace.booking.reservationId);
      applyWorkspace(next, { keepStep: true });
      showToast({ color: 'green', title: 'Photo removed', message: 'ID photo deleted.' });
    } catch (error) {
      showToast({ color: 'red', title: 'Delete failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSubmitting(null);
    }
  };

  const savePayment = async () => {
    if (!propertyId) return;
    setIsSubmitting('payment');
    try {
      const next = await reviewCheckInPayment(propertyId, workspace.booking.reservationId, {
        paymentReviewed: true,
        paymentMethod,
      });
      applyWorkspace(next);
      setActiveStep('room');
      flashSavedStep('payment');
      showToast({ color: 'green', title: 'Payment reviewed', message: 'Payment step is complete.' });
    } catch (error) {
      showToast({ color: 'red', title: 'Save failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSubmitting(null);
    }
  };

  const completeCheckIn = async () => {
    if (!propertyId) return;
    setIsSubmitting('complete');
    try {
      // For walk-ins, receptionist wants to check-in first and collect payment later.
      // If they haven't tapped "Confirm payment plan" yet, silently record the plan
      // as "collect at checkout" so it stops blocking check-in completion.
      if (!workspace.finalChecklist.paymentReviewed) {
        try {
          await reviewCheckInPayment(propertyId, workspace.booking.reservationId, {
            paymentMethod: paymentMethod || 'CASH',
            paymentReviewed: true,
            notes: 'Auto-marked: collect at checkout',
          });
        } catch {
          // Non-blocking - actual money collection happens in the Stay Workspace.
        }
      }
      await checkInReservation(propertyId, workspace.booking.reservationId);
      showToast({
        autoClose: 9000,
        color: 'green',
        title: 'Check-in complete',
        message: `${workspace.guest.fullName || 'Guest'} is now in Room ${workspace.room.roomNumber ?? 'assigned'}. Opening the stay workspace.`,
      });
      router.push(`/guest-stay/${workspace.booking.reservationId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to check in.';
      // Try to match blocker code
      const codeMatch = Object.keys(BLOCKER_MESSAGES).find((code) => message.includes(code));
      showToast({ color: 'red', title: 'Cannot check in yet', message: codeMatch ? BLOCKER_MESSAGES[codeMatch] : message });
    } finally {
      setIsSubmitting(null);
    }
  };

  const c = workspace.finalChecklist;
  const room = workspace.room;
  // Payment review is treated as an optional step for walk-ins - we auto-mark it as
  // "collect at checkout" when the receptionist hits Complete Check-In. So the CTA
  // becomes clickable as soon as everything except the payment review is done.
  const nonPaymentBlockers = c.blockers.filter((code) => code !== 'CHECKIN_PAYMENT_NOT_REVIEWED');
  const canCheckInSoft = c.guestRegistrationComplete && c.identityVerified && c.roomReady && nonPaymentBlockers.length === 0;
  const blockerMessages = c.blockers.map((code) => BLOCKER_MESSAGES[code] ?? code);
  const completedSteps = [
    c.identityVerified,
    c.guestRegistrationComplete,
    c.paymentReviewed,
    c.roomReady,
  ].filter(Boolean).length;
  const nextAction = !c.identityVerified
    ? {
        detail: 'Snap or upload the guest ID, then mark the physical ID as verified.',
        label: 'Verify identity',
        target: 'Step 1',
      }
    : !c.guestRegistrationComplete
      ? {
          detail: 'Fill the missing guest registration fields and save guest details.',
          label: 'Complete guest details',
          target: 'Step 2',
        }
      : !c.roomReady
        ? {
            detail: 'Room must be assigned and ready before the guest can be checked in.',
            label: 'Resolve room readiness',
            target: 'Step 4',
          }
        : !c.paymentReviewed
          ? {
              detail: 'Payment can be marked as collect at checkout if money will be handled after check-in.',
              label: 'Review payment plan',
              target: 'Step 3',
            }
          : {
              detail: 'All required checks are complete. Finish check-in and open the stay workspace.',
              label: 'Complete check-in',
              target: 'Final step',
            };
  const wizardSteps: Array<{
    complete: boolean;
    description: string;
    key: CheckInWizardStep;
    label: string;
    number: number;
  }> = [
    {
      complete: c.identityVerified,
      description: 'ID photos, ID number and face snap',
      key: 'identity',
      label: 'Identity',
      number: 1,
    },
    {
      complete: c.guestRegistrationComplete,
      description: 'Address, mobile and visit purpose',
      key: 'guest',
      label: 'Guest details',
      number: 2,
    },
    {
      complete: c.paymentReviewed,
      description: 'Collect now or mark checkout plan',
      key: 'payment',
      label: 'Payment',
      number: 3,
    },
    {
      complete: c.roomReady,
      description: 'Assigned ready room',
      key: 'room',
      label: 'Room',
      number: 4,
    },
  ];
  const activeStepIndex = wizardSteps.findIndex((step) => step.key === activeStep);
  const activeWizardStep = activeStepIndex >= 0 ? wizardSteps[activeStepIndex] : wizardSteps[0];
  const previousStep = activeStepIndex > 0 ? wizardSteps[activeStepIndex - 1] : undefined;
  const nextStep =
    activeStepIndex >= 0 && activeStepIndex < wizardSteps.length - 1
      ? wizardSteps[activeStepIndex + 1]
      : undefined;
  const missingFieldLabels: Record<string, string> = {
    fullName: 'Full name',
    nationality: 'Nationality',
    addressLine1: 'Address',
    city: 'City',
    state: 'State',
    country: 'Country',
    purposeOfVisit: 'Purpose of visit',
    mobile: 'Mobile',
    passportNumber: 'Passport number',
    passportIssuePlace: 'Passport issue place',
    passportIssueDate: 'Passport issue date',
    passportExpiryDate: 'Passport expiry date',
    visaNumber: 'Visa number',
    visaType: 'Visa type',
    visaIssueDate: 'Visa issue date',
    visaExpiryDate: 'Visa expiry date',
  };
  const missingFields = c.missingRegistrationFields ?? [];
  const requiredGuestValue: Record<string, string> = {
    addressLine1,
    city,
    country,
    fullName,
    mobile,
    nationality,
    purposeOfVisit,
    state,
  };
  const currentMissingFields = missingFields.filter((field) => {
    if (!(field in requiredGuestValue)) return true;
    return !requiredGuestValue[field]?.trim();
  });
  const isMissing = (field: string) => currentMissingFields.includes(field);
  const idRule = idNumberRule(idType);
  const normalizedIdNumber = normalizeIdNumber(idType, idNumber);
  const hasExistingIdNumber = Boolean(workspace.identity.idNumberMasked);
  const idNumberValid = idRule.pattern.test(normalizedIdNumber);
  const canSaveIdentity = (idNumberValid || (hasExistingIdNumber && !idNumber.trim())) && idVerified;
  const idNumberError =
    idNumber.trim() && !idNumberValid ? `${idTypeLabel(idType)} number format is not valid.` : undefined;
  const guestDisplayName = workspace.guest.fullName || fullName.trim() || 'guest';
  const roomDisplayName = room.roomNumber ? `Room ${room.roomNumber}` : 'the room';
  const footerTitle =
    activeStep === 'identity'
      ? (c.identityVerified ? 'Identity is saved' : 'Save identity to continue')
      : activeStep === 'guest'
        ? (c.guestRegistrationComplete ? 'Guest details are complete' : 'Save guest details to continue')
        : activeStep === 'payment'
          ? (c.paymentReviewed ? 'Payment plan reviewed' : 'Review payment plan')
          : canCheckInSoft
            ? 'Ready to check in'
            : 'Room must be ready before check-in';
  const footerDetail =
    activeStep === 'identity'
      ? 'Confirm the ID number and tick physical verification.'
      : activeStep === 'guest'
        ? currentMissingFields.length > 0
          ? `${currentMissingFields.length} registration field${currentMissingFields.length === 1 ? '' : 's'} still missing.`
          : 'Registration details are ready to save.'
        : activeStep === 'payment'
          ? 'Mark the payment plan now, or collect money from the stay workspace after check-in.'
          : canCheckInSoft
            ? 'Guest, ID and room are ready. Finish check-in to open the stay workspace.'
            : 'Open the rooms board if the room needs assignment or readiness work.';
  const footerActionLabel =
    activeStep === 'identity'
      ? 'Save identity'
    : activeStep === 'guest'
        ? `Save ${currentMissingFields.length || ''} guest detail${currentMissingFields.length === 1 ? '' : 's'}`.replace('  ', ' ')
        : activeStep === 'payment'
          ? 'Mark payment reviewed'
          : canCheckInSoft
            ? `Check in ${guestDisplayName} to ${roomDisplayName}`
            : 'Open rooms board';
  const footerActionDisabled =
    activeStep === 'identity'
      ? !canSaveIdentity
      : activeStep === 'room'
        ? false
        : false;
  const footerActionLoading =
    (activeStep === 'identity' && isSubmitting === 'identity') ||
    (activeStep === 'guest' && isSubmitting === 'guest') ||
    (activeStep === 'payment' && isSubmitting === 'payment') ||
    (activeStep === 'room' && isSubmitting === 'complete');
  const footerActionTestId =
    activeStep === 'identity'
      ? 'checkin-save-identity'
      : activeStep === 'guest'
        ? 'checkin-save-guest'
        : activeStep === 'payment'
          ? 'checkin-save-payment'
          : canCheckInSoft
            ? 'checkin-complete'
            : 'checkin-open-rooms';
  const canRunFooterAction = !footerActionDisabled && !footerActionLoading;
  const runFooterAction = () => {
    if (activeStep === 'identity') void saveIdentity();
    else if (activeStep === 'guest') void saveGuestRegistration();
    else if (activeStep === 'payment') void savePayment();
    else if (canCheckInSoft) void completeCheckIn();
    else router.push(`/rooms?mode=assign&status=ready&reservationId=${workspace.booking.reservationId}`);
  };
  const handleStepKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[role="combobox"], [data-no-enter-save="true"]')) return;
    const tagName = target.tagName.toLowerCase();
    if (tagName !== 'input') return;
    if (!canRunFooterAction) return;
    event.preventDefault();
    runFooterAction();
  };

  const stateOptions = country === 'India' ? INDIAN_STATES : undefined;
  const autoBadge = (key: string) =>
    autoFilled[key] ? (
      <Badge color="green" size="xs" variant="light" leftSection={<Sparkles size={10} />}>Auto</Badge>
    ) : null;
  const guestFieldOrder = ['fullName', 'mobile', 'addressLine1', 'country', 'state', 'city', 'purposeOfVisit', 'nationality'];
  const missingGuestFields = guestFieldOrder.filter((field) => isMissing(field));
  const remainingGuestFields = guestFieldOrder.filter((field) => !isMissing(field));
  const renderGuestField = (field: string) => {
    switch (field) {
      case 'fullName':
        return (
          <TextInput
            key={field}
            label="Full name"
            value={fullName}
            required
            error={isMissing('fullName') ? 'Required for registration' : undefined}
            onChange={(e) => { setFullName(e.currentTarget.value); setAutoFilled((prev) => ({ ...prev, fullName: false })); }}
            rightSection={autoBadge('fullName')}
            data-testid="checkin-full-name"
          />
        );
      case 'mobile':
        return (
          <TextInput
            key={field}
            label="Mobile"
            required
            error={isMissing('mobile') ? 'Mobile is needed for registration' : undefined}
            value={mobile}
            onChange={(e) => setMobile(e.currentTarget.value)}
            data-testid="checkin-mobile"
          />
        );
      case 'addressLine1':
        return (
          <TextInput
            key={field}
            label="Address"
            required
            error={isMissing('addressLine1') ? 'Address is needed for registration' : undefined}
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.currentTarget.value)}
            data-testid="checkin-address"
          />
        );
      case 'country':
        return (
          <Select
            key={field}
            label="Country"
            required
            error={isMissing('country') ? 'Required' : undefined}
            value={country || 'India'}
            onChange={(v) => setCountry(v ?? 'India')}
            data={COMMON_COUNTRIES}
            searchable
            data-testid="checkin-country"
          />
        );
      case 'state':
        return stateOptions ? (
          <Select
            key={field}
            label="State"
            required
            error={isMissing('state') ? 'Please pick a state' : undefined}
            value={state || null}
            onChange={(v) => setState(v ?? '')}
            data={stateOptions}
            searchable
            clearable
            placeholder="Select state"
            data-testid="checkin-state"
          />
        ) : (
          <TextInput
            key={field}
            label="State / Region"
            required
            error={isMissing('state') ? 'Required' : undefined}
            value={state}
            onChange={(e) => setState(e.currentTarget.value)}
            placeholder="e.g. California"
            data-testid="checkin-state"
          />
        );
      case 'city':
        return (
          <TextInput
            key={field}
            label="City"
            required
            error={isMissing('city') ? 'Required' : undefined}
            value={city}
            onChange={(e) => setCity(e.currentTarget.value)}
            placeholder={cityPlaceholder(state)}
            data-testid="checkin-city"
          />
        );
      case 'purposeOfVisit':
        return (
          <Select
            key={field}
            label="Purpose of visit"
            required
            error={isMissing('purposeOfVisit') ? 'Required' : undefined}
            value={purposeOfVisit || 'Leisure'}
            onChange={(v) => setPurposeOfVisit(v ?? 'Leisure')}
            data={PURPOSE_OF_VISIT}
            data-testid="checkin-purpose"
          />
        );
      case 'nationality':
        return (
          <Select
            key={field}
            label="Nationality"
            required
            error={isMissing('nationality') ? 'Required' : undefined}
            value={nationality || 'INDIAN'}
            onChange={(v) => setNationality(v ?? 'INDIAN')}
            data={COMMON_NATIONALITIES}
            searchable
            data-testid="checkin-nationality"
          />
        );
      default:
        return null;
    }
  };

  const totalPax = (workspace.booking.adults ?? 0) + (workspace.booking.children ?? 0);
  const needsExtraRoom = totalPax > 2;
  const stepStatusBadge = (step: CheckInWizardStep, complete: boolean) => {
    if (savedStep === step) return { color: 'green', label: 'Saved' };
    if (complete) return { color: 'green', label: 'Ready' };
    if (step === 'guest' && missingGuestFields.length > 0) return { color: 'orange', label: `${missingGuestFields.length} missing` };
    if (step === 'payment') return { color: 'blue', label: 'Optional' };
    if (step === 'identity') return { color: 'orange', label: 'Needed' };
    return { color: 'gray', label: 'Pending' };
  };

  return (
    <Stack gap={spacing[3]}>
      <Paper radius={radius.lg} p={18} style={cardStyle}>
        <Group justify="space-between" align="flex-start" gap={spacing[3]} wrap="wrap">
          <Stack gap={8}>
            <Group gap={12}>
              <Button component={Link} href={`/reservations/${workspace.booking.reservationId}`} variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content">Back to booking</Button>
              <Button component={Link} href="/" variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content">Back to Front Desk</Button>
            </Group>
            <Box>
              <Text c="#64748b" size="xs" fw={800} tt="uppercase">Check-in</Text>
              <Title order={1} c="#101828" style={{ fontSize: 28, fontWeight: 850 }}>
                {workspace.booking.reservationCode}
              </Title>
            </Box>
            <Group gap={8} wrap="wrap">
              <Badge color="gray" variant="light">{workspace.guest.fullName || 'Guest'}</Badge>
              <Badge color="gray" variant="light">
                {workspace.booking.adults} adult{workspace.booking.adults === 1 ? '' : 's'}{workspace.booking.children > 0 ? `, ${workspace.booking.children} child${workspace.booking.children === 1 ? '' : 'ren'}` : ''}
              </Badge>
              <Badge color="gray" variant="light">{computeNights(workspace.booking.arrivalDate, workspace.booking.departureDate)} nights</Badge>
              <Badge color="gray" variant="light">Room {room.roomNumber ?? 'Unassigned'} - {room.roomType ?? '-'}</Badge>
            </Group>
          </Stack>
          <Badge color={canCheckInSoft ? 'green' : 'stayosBrand'} variant="light" size="lg">
            {completedSteps}/4 ready
          </Badge>
        </Group>
      </Paper>
      <Box className={styles.checkInShell}>
        <Paper radius={radius.lg} p={16} className={styles.checkInSidebar} style={cardStyle} data-testid="checkin-wizard-nav">
          <Stack gap={spacing[3]}>
            <Box>
              <Text c="#64748b" size="xs" fw={900} tt="uppercase">Check-in flow</Text>
              <Text c="#101828" fw={900} mt={2}>{nextAction.label}</Text>
              <Text c="#64748b" size="sm" mt={4}>{nextAction.detail}</Text>
            </Box>
            <Stack gap={8}>
              {wizardSteps.map((step) => {
                const selected = activeStep === step.key;
                const status = stepStatusBadge(step.key, step.complete);
                return (
                  <Button
                    key={step.key}
                    variant={selected ? 'filled' : 'subtle'}
                    color={step.complete ? 'green' : selected ? 'stayosBrand' : 'gray'}
                    justify="flex-start"
                    h="auto"
                    py={10}
                    leftSection={
                      <ThemeIcon color={step.complete ? 'green' : selected ? 'stayosBrand' : 'gray'} variant={selected ? 'white' : 'light'} radius="xl" size={28}>
                        {step.complete ? <Check size={15} /> : <Text size="xs" fw={900}>{step.number}</Text>}
                      </ThemeIcon>
                    }
                    onClick={() => setActiveStep(step.key)}
                    styles={{ label: { width: '100%' } }}
                  >
                    <Stack gap={1} align="flex-start">
                      <Group justify="space-between" w="100%" gap={8} wrap="nowrap">
                        <Text fw={850} size="sm">{step.label}</Text>
                        <Badge
                          color={status.color}
                          variant={selected ? 'white' : 'light'}
                          size="xs"
                          className={savedStep === step.key ? styles.savedPulse : undefined}
                        >
                          {status.label}
                        </Badge>
                      </Group>
                      <Text size="xs" c={selected ? 'rgba(255,255,255,0.82)' : '#64748b'}>
                        {step.key === 'guest' && !step.complete && missingGuestFields.length > 0
                          ? `${missingGuestFields.length} missing`
                          : step.complete ? 'Done' : step.description}
                      </Text>
                    </Stack>
                  </Button>
                );
              })}
            </Stack>
            {activeStep === 'guest' && missingGuestFields.length > 0 ? (
              <Alert color="orange" variant="light" icon={<AlertTriangle size={17} />} data-testid="checkin-blockers">
                <Stack gap={6}>
                  <Text size="xs" fw={800}>Missing guest details</Text>
                  <Group gap={5} wrap="wrap">
                    {missingGuestFields.map((f) => (
                      <Badge key={f} color="orange" variant="filled" size="xs" data-testid={`missing-${f}`}>
                        {missingFieldLabels[f] ?? f}
                      </Badge>
                    ))}
                  </Group>
                </Stack>
              </Alert>
            ) : null}
          </Stack>
        </Paper>

        <Stack gap={spacing[3]} onKeyDown={handleStepKeyDown}>

      {activeStep === 'identity' ? (
      <Box data-checkin-step="identity">
      <StepCard icon={<IdCard size={17} />} title="Step 1 · Verify identity" complete={c.identityVerified}>
        <Stack gap={spacing[3]}>
          {isDetecting ? (
            <Alert color="blue" variant="light" icon={<Loader size="xs" color="blue" />} data-testid="checkin-ocr-progress">
              <Text size="sm" fw={700}>Reading the ID...</Text>
              <Text size="xs" c="#64748b">Reading uploaded ID photos. If nothing fills, continue manually.</Text>
            </Alert>
          ) : (
            <Group justify="space-between" align="center" wrap="wrap" gap={8}>
              <Text c="#64748b" size="sm" style={{ flex: 1, minWidth: 240 }}>
                Upload ID photos, then type details manually or use auto-fill if the image is clear.
              </Text>
              <Group gap={8}>
                <Button
                  variant="light"
                  color="stayosBrand"
                  leftSection={<Sparkles size={16} />}
                  loading={isDetecting}
                  onClick={() => void tryAutoFillFromId()}
                  data-testid="checkin-try-autofill"
                >
                  Try auto-fill
                </Button>
                <Button
                  variant="light"
                  color="stayosBrand"
                  leftSection={<Camera size={16} />}
                  onClick={() => setSendToPhoneOpened(true)}
                  data-testid="checkin-send-to-phone"
                >
                  Send to phone
                </Button>
              </Group>
            </Group>
          )}
          <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
            <Text size="xs" fw={800} c="#334155" mb={8} tt="uppercase">1a. Pick the ID type first</Text>
            <Select
              value={idType}
              onChange={(v) => {
                const nextType = v ?? 'AADHAAR';
                setIdType(nextType);
                setIdNumber((current) => normalizeIdNumber(nextType, current));
              }}
              data={[
                { label: 'Aadhaar', value: 'AADHAAR' },
                { label: 'Passport', value: 'PASSPORT' },
                { label: 'Driving License', value: 'DRIVING_LICENSE' },
                { label: 'Voter ID', value: 'VOTER_ID' },
                { label: 'PAN', value: 'PAN' },
                { label: 'Other', value: 'OTHER' },
              ]}
              data-testid="checkin-id-type"
            />
          </Paper>
          <Text size="xs" fw={800} c="#334155" mt={4} tt="uppercase">1b. Snap the front &amp; back of the {idTypeLabel(idType)}</Text>
          <Group grow align="stretch">
            <IdPhotoTile
              side="front"
              label={`${idTypeLabel(idType)} - front`}
              document={workspace.documents.find((d) => d.side === 'ID_FRONT')}
              propertyId={propertyId}
              reservationId={workspace.booking.reservationId}
              onUpload={uploadIdPhoto}
              onDelete={deleteIdPhoto}
              uploading={isSubmitting === 'id-front'}
            />
            <IdPhotoTile
              side="back"
              label={`${idTypeLabel(idType)} - back (optional)`}
              document={workspace.documents.find((d) => d.side === 'ID_BACK')}
              propertyId={propertyId}
              reservationId={workspace.booking.reservationId}
              onUpload={uploadIdPhoto}
              onDelete={deleteIdPhoto}
              uploading={isSubmitting === 'id-back'}
            />
          </Group>
          <Text size="xs" fw={800} c="#334155" mt={4} tt="uppercase">1c. Face match - save the guest snap</Text>
          {cameraSkipped ? (
            <Alert color="blue" variant="light" icon={<Info size={17} />}>
              Face snap skipped for now. The receptionist can still complete ID verification after checking the physical ID.
            </Alert>
          ) : (
            <FaceMatchCard
              compact
              idPhotoUrl={idFrontPreviewUrl}
              persistedSnapUrl={guestFacePreviewUrl}
              propertyId={propertyId}
              reservationId={workspace.booking.reservationId}
              onSaved={refreshWorkspace}
            />
          )}
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => setCameraSkipped((current) => !current)}
              data-no-enter-save="true"
            >
              {cameraSkipped ? 'Use face camera' : 'Skip camera for now'}
            </Button>
          </Group>
          <Text size="xs" fw={800} c="#334155" mt={4} tt="uppercase">1d. Confirm the ID number, then save</Text>
          <Group grow>
            <TextInput
              label={workspace.identity.idNumberMasked ? `ID number (on file: ${workspace.identity.idNumberMasked})` : 'ID number'}
              value={idNumber}
              error={idNumberError}
              description={idRule.hint}
              maxLength={idRule.maxLength}
              inputMode={idType === 'AADHAAR' ? 'numeric' : 'text'}
              onChange={(e) => { setIdNumber(normalizeIdNumber(idType, e.currentTarget.value)); setAutoFilled((prev) => ({ ...prev, idNumber: false })); }}
              rightSection={isDetecting ? <Loader size="xs" color="stayosBrand" /> : autoBadge('idNumber')}
              placeholder={isDetecting ? 'Reading ID...' : undefined}
              data-testid="checkin-id-number"
            />
          </Group>
          <Checkbox label="I have physically verified the ID matches the guest" checked={idVerified} onChange={(e) => setIdVerified(e.currentTarget.checked)} data-testid="checkin-id-verified" />
        </Stack>
      </StepCard>
      </Box>
      ) : null}

      {activeStep === 'guest' ? (
      <Box data-checkin-step="guest">
      <StepCard icon={<UserRound size={17} />} title="Step 2 · Guest details" complete={c.guestRegistrationComplete}>
        <Stack gap={spacing[3]}>
          {missingGuestFields.length > 0 ? (
            <Paper
              radius={radius.md}
              p={14}
              style={{
                background: 'linear-gradient(180deg,#fffaf0 0%,#fff7ed 100%)',
                border: '1px solid rgba(251,146,60,0.36)',
              }}
            >
              <Group justify="space-between" mb={10} gap={8}>
                <Box>
                  <Text fw={900} c="#9a3412">Finish these first</Text>
                  <Text size="sm" c="#9a3412">
                    {missingGuestFields.length} field{missingGuestFields.length === 1 ? '' : 's'} needed before check-in.
                  </Text>
                </Box>
                <Badge color="orange" variant="filled">{missingGuestFields.length} missing</Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                {missingGuestFields.map(renderGuestField)}
              </SimpleGrid>
            </Paper>
          ) : (
            <Alert color="green" variant="light" icon={<Check size={17} />}>
              Required registration details are complete. Review anything below only if needed.
            </Alert>
          )}

          {(showAllGuestDetails || missingGuestFields.length === 0) ? (
          <Paper
              radius={radius.md}
              p={14}
              style={{
                background: '#ffffff',
                border: '1px solid rgba(226,232,240,0.78)',
                boxShadow: '0 8px 22px rgba(15,23,42,0.025)',
              }}
            >
            <Group justify="space-between" mb={10} gap={8}>
              <Box>
                <Text fw={850} c="#101828">Registration details</Text>
                <Text size="sm" c="#64748b">Already captured fields stay editable for corrections.</Text>
              </Box>
              {missingGuestFields.length > 0 ? (
                <Button variant="subtle" color="gray" size="xs" onClick={() => setShowAllGuestDetails(false)} data-no-enter-save="true">
                  Missing only
                </Button>
              ) : null}
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
              {remainingGuestFields.map(renderGuestField)}
              <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
              <TextInput
                label="Date of birth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => { setDateOfBirth(e.currentTarget.value); setAutoFilled((prev) => ({ ...prev, dateOfBirth: false })); }}
                rightSection={autoBadge('dateOfBirth')}
                data-testid="checkin-dob"
              />
            </SimpleGrid>
          </Paper>
          ) : (
            <Group justify="flex-end">
              <Button variant="light" color="stayosBrand" size="sm" onClick={() => setShowAllGuestDetails(true)} data-no-enter-save="true">
                Show all details
              </Button>
            </Group>
          )}
        </Stack>
      </StepCard>
      </Box>
      ) : null}

      {activeStep === 'payment' ? (
      <Box data-checkin-step="payment">
      <StepCard icon={<CreditCard size={17} />} title="Step 3 · Payment plan" complete={c.paymentReviewed}>
        <Stack gap={spacing[3]}>
          <Alert color="stayosBrand" variant="light" icon={<Info size={17} />}>
            <Text size="sm">
              <b>This step just records the plan</b>. You can collect now, or mark it as collect at checkout and handle money from the <b>Stay Workspace</b> after check-in.
            </Text>
          </Alert>

          {/* Big, clear billing summary strip */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
            <Paper p={14} radius={radius.md} style={{ background: workspace.payment.outstandingAmount > 0 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${workspace.payment.outstandingAmount > 0 ? '#fdba74' : '#86efac'}` }}>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">Outstanding</Text>
              <Text fw={900} size="xl" mt={2} c={workspace.payment.outstandingAmount > 0 ? '#c2410c' : '#166534'} data-testid="payment-outstanding">
                Rs {workspace.payment.outstandingAmount.toLocaleString('en-IN')}
              </Text>
              <Text size="xs" c="#94a3b8" mt={2}>
                {workspace.payment.outstandingAmount > 0 ? 'Due before checkout' : 'Fully paid'}
              </Text>
            </Paper>
            <Paper p={14} radius={radius.md} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">Payment status</Text>
              <Text fw={800} size="lg" mt={2} c="#101828">
                {workspace.payment.paymentStatus.replace(/_/g, ' ')}
              </Text>
              <Text size="xs" c="#94a3b8" mt={2}>Live from folio</Text>
            </Paper>
            <Paper p={14} radius={radius.md} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">Stay timing</Text>
              <Text fw={800} size="lg" mt={2} c="#101828">
                {computeNights(workspace.booking.arrivalDate, workspace.booking.departureDate)} night{computeNights(workspace.booking.arrivalDate, workspace.booking.departureDate) === 1 ? '' : 's'}
              </Text>
              <Text size="xs" c="#94a3b8" mt={2}>2:00 PM check-in · 12:00 PM check-out</Text>
            </Paper>
          </SimpleGrid>

          {/* Payment method chips - one-click choice */}
          <Stack gap={6}>
            <Text c="#334155" size="xs" fw={800} tt="uppercase">Preferred payment method (planned)</Text>
            <Group gap={8}>
              {[
                { label: 'Cash', value: 'CASH' },
                { label: 'Card', value: 'CARD' },
                { label: 'UPI', value: 'UPI' },
                { label: 'Corporate / BTC', value: 'BTC' },
                { label: 'Prepaid (OTA)', value: 'PREPAID' },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  variant={paymentMethod === opt.value ? 'filled' : 'light'}
                  color={paymentMethod === opt.value ? 'stayosBrand' : 'gray'}
                  size="sm"
                  onClick={() => setPaymentMethod(opt.value)}
                  data-testid={`payment-chip-${opt.value}`}
                >
                  {opt.label}
                </Button>
              ))}
            </Group>
          </Stack>

          <Group justify="flex-end" wrap="wrap" gap={8}>
            <Button color="stayosBrand" leftSection={<CreditCard size={16} />} onClick={() => setPaymentCollectionOpened(true)} data-testid="checkin-collect-payment">
              Collect payment now
            </Button>
          </Group>
        </Stack>
      </StepCard>
      </Box>
      ) : null}

      {activeStep === 'room' ? (
      <Box data-checkin-step="room">
      <StepCard icon={<BedDouble size={17} />} title="Step 4 · Room readiness" complete={c.roomReady}>
        <Stack gap={8}>
          <Text size="sm">
            <b>Room {room.roomNumber ?? 'Unassigned'}</b> · {room.roomType ?? '-'} · Status: <b>{room.operationalStatus ?? 'N/A'}</b>
          </Text>
          {room.warnings.length > 0 ? (
            <Alert color="orange" variant="light" icon={<AlertTriangle size={16} />}>
              <Stack gap={4}>
                {room.warnings.map((warning, i) => <Text key={i} size="sm">{warning}</Text>)}
              </Stack>
            </Alert>
          ) : null}
          {!room.roomId ? (
            <Button component={Link} href={`/reservations/${workspace.booking.reservationId}`} variant="light" color="stayosBrand" w="fit-content">Assign a room</Button>
          ) : !c.roomReady ? (
            <Button component={Link} href={`/rooms`} variant="light" color="stayosBrand" w="fit-content">Open rooms board</Button>
          ) : null}
        </Stack>
      </StepCard>
      </Box>
      ) : null}

      <Card
        radius={radius.lg}
        p={16}
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 -10px 24px rgba(15, 23, 42, 0.06)',
          position: 'sticky',
          bottom: 12,
          zIndex: 2,
        }}
      >
        <Group justify="space-between" wrap="wrap" gap={8}>
          <Group gap={10}>
            <ThemeIcon color={canCheckInSoft ? 'green' : 'stayosBrand'} variant="light" radius="xl" size={40}>
              <ShieldCheck size={20} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text c="#101828" fw={800}>{footerTitle}</Text>
              <Text c="#64748b" size="sm">{footerDetail}</Text>
            </Stack>
          </Group>
          <Group gap={8}>
            <Button
              variant="subtle"
              color="gray"
              disabled={!previousStep}
              onClick={() => previousStep && setActiveStep(previousStep.key)}
            >
              Back
            </Button>
            {activeStep !== 'room' && activeWizardStep.complete && nextStep ? (
              <Button variant="light" color="stayosBrand" onClick={() => setActiveStep(nextStep.key)}>
                Next: {nextStep.label}
              </Button>
            ) : null}
            <Button
              size="md"
              color={activeStep === 'room' && canCheckInSoft ? 'green' : 'stayosBrand'}
              disabled={footerActionDisabled}
              loading={footerActionLoading}
              onClick={runFooterAction}
              data-testid={footerActionTestId}
            >
              {footerActionLabel}
            </Button>
          </Group>
        </Group>
      </Card>
        </Stack>
      </Box>

      <SendToPhoneModal
        opened={sendToPhoneOpened}
        onClose={() => setSendToPhoneOpened(false)}
        propertyId={propertyId}
        reservationId={workspace.booking.reservationId}
        frontUploadedInitially={Boolean(workspace.documents.find((d) => d.side === 'ID_FRONT'))}
        backUploadedInitially={Boolean(workspace.documents.find((d) => d.side === 'ID_BACK'))}
        onCaptured={refreshWorkspace}
      />
      <CheckoutModal
        opened={paymentCollectionOpened}
        onClose={() => setPaymentCollectionOpened(false)}
        propertyId={propertyId}
        reservationId={workspace.booking.reservationId}
        guestName={workspace.guest.fullName || 'Guest'}
        mode="checkin-payment"
        onPaymentUpdated={refreshWorkspace}
        onConfirmCheckout={async () => undefined}
      />
    </Stack>
  );
}

export default CheckInWorkspacePage;
