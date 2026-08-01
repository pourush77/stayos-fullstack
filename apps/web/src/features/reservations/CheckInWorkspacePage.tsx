'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { detectIdFromImage } from './utils/id-detection';
import { FaceMatchCard } from './components/FaceMatchCard';
import { SendToPhoneModal } from './components/SendToPhoneModal';
import { COMMON_COUNTRIES, COMMON_NATIONALITIES, INDIAN_STATES, PURPOSE_OF_VISIT } from './constants/guest-form-options';

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

// Common cities per Indian state — used as placeholder suggestion for the city field.
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

function computeNights(arrival: string, departure: string): number {
  const a = new Date(arrival + 'T00:00:00');
  const d = new Date(departure + 'T00:00:00');
  const diff = Math.round((d.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  return diff > 0 ? diff : 1;
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
    <Card radius={radius.lg} p={20} style={cardStyle}>
      <Group justify="space-between" align="center" mb={12}>
        <Group gap={10}>
          <ThemeIcon color={complete ? 'green' : 'stayosBrand'} variant="light" radius={radius.md} size={34}>{icon}</ThemeIcon>
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
        background: hasImage || isPdf ? '#ffffff' : '#f8fafc',
        border: `1px dashed ${hasImage || isPdf ? '#7d4dd6' : '#cbd5e1'}`,
        minHeight: 180,
      }}
      data-testid={`id-photo-tile-${side}`}
    >
      <Stack gap={8} align="center" justify="center" style={{ minHeight: 156 }}>
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
              maxHeight: 120,
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
  const [nationality, setNationality] = useState<string>('Indian');
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

  const applyWorkspace = useCallback((next: CheckInWorkspaceDto) => {
    setWorkspace(next);
    setFullName(next.guest.fullName ?? '');
    setMobile(next.guest.mobile ?? '');
    setEmail(next.guest.email ?? '');
    setNationality(next.guest.nationality ?? 'Indian');
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

  // Manual workspace reload — used after phone uploads or face-snap persistence completes.
  const refreshWorkspace = useCallback(() => {
    if (!propertyId || !params.reservationId) return;
    void getCheckInWorkspace(propertyId, params.reservationId).then(applyWorkspace).catch(() => undefined);
  }, [propertyId, params.reservationId, applyWorkspace]);

  if (loadError) {
    return (
      <Stack gap={spacing[3]}>
        <Alert color="red" variant="light" icon={<AlertTriangle size={17} />}>{loadError}</Alert>
        <Button component={Link} href={`/reservations/${params.reservationId}`} variant="light" color="stayosBrand" leftSection={<ChevronLeft size={16} />}>Back to booking</Button>
      </Stack>
    );
  }

  if (!workspace) {
    return <Alert color="blue" variant="light">Loading check-in workspace…</Alert>;
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
      applyWorkspace(next);
      showToast({ color: 'green', title: 'Guest details saved', message: 'Registration updated.' });
    } catch (error) {
      showToast({ color: 'red', title: 'Save failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSubmitting(null);
    }
  };

  const saveIdentity = async () => {
    if (!propertyId) return;
    if (!idNumber.trim() && !workspace.identity.idNumberMasked) {
      showToast({ color: 'red', title: 'ID number required', message: 'Enter the ID number to save.' });
      return;
    }
    setIsSubmitting('identity');
    try {
      const next = await updateIdentityVerification(propertyId, workspace.booking.reservationId, {
        idType,
        idNumber: idNumber.trim() || workspace.identity.idNumberMasked || '',
        verified: idVerified,
      });
      applyWorkspace(next);
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
      applyWorkspace(next);
      showToast({ color: 'green', title: 'Photo uploaded', message: `${side === 'front' ? 'Front' : 'Back'} of ID saved.` });

      // Auto-detect ID type + number + name from the front photo (client-side OCR — Tesseract.js).
      if (side === 'front' && file.type.startsWith('image/')) {
        try {
          setIsDetecting(true);
          const detected = await detectIdFromImage(file);
          if (detected) {
            const bits: string[] = [];
            const flags: Record<string, boolean> = {};
            if (detected.idType !== 'OTHER' && detected.idNumber) {
              setIdType(detected.idType);
              setIdNumber(detected.idNumber);
              flags.idNumber = true;
              bits.push(`${detected.idType.replace('_', ' ')}: ${detected.idNumber}`);
            }
            if (detected.fullName && !fullName.trim()) {
              // Only auto-fill the guest name if the receptionist hasn't already picked or typed one.
              setFullName(detected.fullName);
              flags.fullName = true;
              bits.push(`Name: ${detected.fullName}`);
            } else if (detected.fullName && detected.fullName.toLowerCase() !== fullName.trim().toLowerCase()) {
              // Guest already has a name — don't overwrite, just surface the detected one so front desk can compare.
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
                message: `${bits.join(' · ')} — please confirm and save.`,
              });
            } else {
              showToast({
                color: 'yellow',
                title: 'Could not read ID clearly',
                message: 'The photo looks blurry / not an ID. Try a well-lit, close-up snap in daylight — or type the ID number manually below.',
                autoClose: 8000,
              });
            }
          }
        } catch (ocrError) {
          console.warn('OCR failed', ocrError);
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

  const deleteIdPhoto = async (documentId: string) => {
    if (!propertyId) return;
    setIsSubmitting('id-delete');
    try {
      await deleteCheckInDocument(propertyId, workspace.booking.reservationId, documentId);
      const next = await getCheckInWorkspace(propertyId, workspace.booking.reservationId);
      applyWorkspace(next);
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
      await checkInReservation(propertyId, workspace.booking.reservationId);
      showToast({ color: 'green', title: 'Guest checked in', message: 'Redirecting to the stay workspace.' });
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
  const blockerMessages = c.blockers.map((code) => BLOCKER_MESSAGES[code] ?? code);
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
  const isMissing = (field: string) => missingFields.includes(field);

  const stateOptions = country === 'India' ? INDIAN_STATES : undefined;
  const autoBadge = (key: string) =>
    autoFilled[key] ? (
      <Badge color="green" size="xs" variant="light" leftSection={<Sparkles size={10} />}>Auto</Badge>
    ) : null;

  const totalPax = (workspace.booking.adults ?? 0) + (workspace.booking.children ?? 0);
  const needsExtraRoom = totalPax > 2;

  return (
    <Stack gap={spacing[3]}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Stack gap={6}>
          <Button component={Link} href={`/reservations/${workspace.booking.reservationId}`} variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content">Back to booking</Button>
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>Check-In · {workspace.booking.reservationCode}</Title>
          <Group gap={8} wrap="wrap">
            <Text c="#64748b" size="sm">
              {workspace.guest.fullName || 'Guest'} · {workspace.booking.arrivalDate} → {workspace.booking.departureDate} · Room {room.roomNumber ?? 'Unassigned'} ({room.roomType ?? '—'})
            </Text>
            <Badge color="stayosBrand" variant="light" leftSection={<Users size={12} />}>
              {workspace.booking.adults} adult{workspace.booking.adults === 1 ? '' : 's'}
              {workspace.booking.children > 0 ? ` · ${workspace.booking.children} child${workspace.booking.children === 1 ? '' : 'ren'}` : ''}
            </Badge>
            <Badge color="gray" variant="light" leftSection={<Clock3 size={12} />} data-testid="checkin-nights">
              {computeNights(workspace.booking.arrivalDate, workspace.booking.departureDate)} night{computeNights(workspace.booking.arrivalDate, workspace.booking.departureDate) === 1 ? '' : 's'} · arrive 2:00 PM · depart 12:00 PM
            </Badge>
          </Group>
        </Stack>
      </Group>

      {/* Quick-reference "how to check in" strip — keeps the receptionist oriented */}
      <Alert color="stayosBrand" variant="light" icon={<Info size={17} />} data-testid="checkin-howto">
        <Group gap={spacing[3]} wrap="wrap">
          <Text size="sm" fw={700} c="#5b21b6">How to check in:</Text>
          <Text size="sm" c="#334155"><b>1.</b> Snap or upload the guest&apos;s ID front — we&apos;ll auto-fill name, DOB & ID number.</Text>
          <Text size="sm" c="#334155"><b>2.</b> Confirm the details, then click <b>Save guest details</b>.</Text>
          <Text size="sm" c="#334155"><b>3.</b> Start the webcam, snap the guest, tick <b>ID matches</b>, then <b>Save identity</b>.</Text>
          <Text size="sm" c="#334155"><b>4.</b> Confirm payment method and hit <b>Complete Check-In →</b>.</Text>
        </Group>
      </Alert>

      {needsExtraRoom ? (
        <Alert color="orange" variant="light" icon={<AlertTriangle size={17} />} data-testid="checkin-group-note">
          <Text size="sm">
            This booking is for <b>{totalPax} guests</b>. If they need an additional room, use <b>Back to booking → Move Room</b> or create a separate reservation for the extra guests before checking in.
          </Text>
        </Alert>
      ) : null}

      <Paper radius={radius.lg} p={12} style={cardStyle}>
        <Group gap={8} wrap="wrap">
          <ChecklistPill ok={c.guestRegistrationComplete} label="Guest registration" />
          <ChecklistPill ok={c.identityVerified} label="Identity verified" />
          <ChecklistPill ok={c.paymentReviewed} label="Payment reviewed" />
          <ChecklistPill ok={c.roomReady} label="Room ready" />
        </Group>
        {blockerMessages.length > 0 ? (
          <Alert mt={12} color="orange" variant="light" icon={<AlertTriangle size={17} />} data-testid="checkin-blockers">
            <Stack gap={6}>
              {blockerMessages.map((msg, i) => <Text key={i} size="sm">{msg}</Text>)}
              {missingFields.length > 0 ? (
                <Group gap={6} wrap="wrap" mt={4}>
                  <Text size="xs" fw={700} c="#78350f">Missing fields:</Text>
                  {missingFields.map((f) => (
                    <Badge key={f} color="orange" variant="filled" size="sm" data-testid={`missing-${f}`}>
                      {missingFieldLabels[f] ?? f}
                    </Badge>
                  ))}
                </Group>
              ) : null}
            </Stack>
          </Alert>
        ) : null}
      </Paper>

      {/* Identity FIRST — snapping ID auto-fills the guest form below */}
      <StepCard icon={<IdCard size={17} />} title="Step 1 · Snap the ID (auto-fills the guest form)" complete={c.identityVerified}>
        <Stack gap={spacing[3]}>
          {isDetecting ? (
            <Alert color="blue" variant="light" icon={<Loader size="xs" color="blue" />} data-testid="checkin-ocr-progress">
              <Text size="sm" fw={700}>Reading the ID…</Text>
              <Text size="xs" c="#64748b">This takes a few seconds. Name, DOB and ID number will be filled below.</Text>
            </Alert>
          ) : (
            <Group justify="space-between" align="center" wrap="wrap" gap={8}>
              <Text c="#64748b" size="sm" style={{ flex: 1, minWidth: 240 }}>
                Tap <b>Snap / Upload</b> below on this device, or <b>Send to phone</b> to let the guest snap with their own camera.
              </Text>
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
          )}
          <Paper radius={radius.md} p={12} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
            <Text size="xs" fw={800} c="#334155" mb={8} tt="uppercase">1a. Pick the ID type first</Text>
            <Select
              value={idType}
              onChange={(v) => setIdType(v ?? 'AADHAAR')}
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
              label={`${idTypeLabel(idType)} — front`}
              document={workspace.documents.find((d) => d.side === 'ID_FRONT')}
              propertyId={propertyId}
              reservationId={workspace.booking.reservationId}
              onUpload={uploadIdPhoto}
              onDelete={deleteIdPhoto}
              uploading={isSubmitting === 'id-front'}
            />
            <IdPhotoTile
              side="back"
              label={`${idTypeLabel(idType)} — back (optional)`}
              document={workspace.documents.find((d) => d.side === 'ID_BACK')}
              propertyId={propertyId}
              reservationId={workspace.booking.reservationId}
              onUpload={uploadIdPhoto}
              onDelete={deleteIdPhoto}
              uploading={isSubmitting === 'id-back'}
            />
          </Group>
          <Text size="xs" fw={800} c="#334155" mt={4} tt="uppercase">1c. Face match — save the guest snap</Text>
          <FaceMatchCard
            idPhotoUrl={idFrontPreviewUrl}
            persistedSnapUrl={guestFacePreviewUrl}
            propertyId={propertyId}
            reservationId={workspace.booking.reservationId}
            onSaved={refreshWorkspace}
          />
          <Text size="xs" fw={800} c="#334155" mt={4} tt="uppercase">1d. Confirm the ID number, then save</Text>
          <Group grow>
            <TextInput
              label={workspace.identity.idNumberMasked ? `ID number (on file: ${workspace.identity.idNumberMasked})` : 'ID number'}
              value={idNumber}
              onChange={(e) => { setIdNumber(e.currentTarget.value); setAutoFilled((prev) => ({ ...prev, idNumber: false })); }}
              rightSection={isDetecting ? <Loader size="xs" color="stayosBrand" /> : autoBadge('idNumber')}
              placeholder={isDetecting ? 'Reading ID…' : undefined}
              data-testid="checkin-id-number"
            />
          </Group>
          <Checkbox label="I have physically verified the ID matches the guest" checked={idVerified} onChange={(e) => setIdVerified(e.currentTarget.checked)} data-testid="checkin-id-verified" />
          <Group justify="flex-end">
            <Button color="stayosBrand" loading={isSubmitting === 'identity'} onClick={() => void saveIdentity()} data-testid="checkin-save-identity">Save identity</Button>
          </Group>
        </Stack>
      </StepCard>

      <StepCard icon={<UserRound size={17} />} title="Step 2 · Confirm guest details" complete={c.guestRegistrationComplete}>
        <Stack gap={spacing[3]}>
          <Group grow>
            <TextInput
              label="Full name"
              value={fullName}
              required
              error={isMissing('fullName') ? 'Required' : undefined}
              onChange={(e) => { setFullName(e.currentTarget.value); setAutoFilled((prev) => ({ ...prev, fullName: false })); }}
              rightSection={autoBadge('fullName')}
              data-testid="checkin-full-name"
            />
            <TextInput
              label="Mobile"
              required
              error={isMissing('mobile') ? 'Required' : undefined}
              value={mobile}
              onChange={(e) => setMobile(e.currentTarget.value)}
              data-testid="checkin-mobile"
            />
          </Group>
          <Group grow>
            <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
            <Select
              label="Nationality"
              required
              error={isMissing('nationality') ? 'Required' : undefined}
              value={nationality || 'Indian'}
              onChange={(v) => setNationality(v ?? 'Indian')}
              data={COMMON_NATIONALITIES}
              searchable
              data-testid="checkin-nationality"
            />
            <TextInput
              label="Date of birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => { setDateOfBirth(e.currentTarget.value); setAutoFilled((prev) => ({ ...prev, dateOfBirth: false })); }}
              rightSection={autoBadge('dateOfBirth')}
              data-testid="checkin-dob"
            />
          </Group>
          <TextInput
            label="Address"
            required
            error={isMissing('addressLine1') ? 'Required' : undefined}
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.currentTarget.value)}
            data-testid="checkin-address"
          />
          <Group grow>
            <Select
              label="Country"
              required
              error={isMissing('country') ? 'Required' : undefined}
              value={country || 'India'}
              onChange={(v) => setCountry(v ?? 'India')}
              data={COMMON_COUNTRIES}
              searchable
              data-testid="checkin-country"
            />
            {stateOptions ? (
              <Select
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
                label="State / Region"
                required
                error={isMissing('state') ? 'Required' : undefined}
                value={state}
                onChange={(e) => setState(e.currentTarget.value)}
                placeholder="e.g. California"
                data-testid="checkin-state"
              />
            )}
            <TextInput
              label="City"
              required
              error={isMissing('city') ? 'Required' : undefined}
              value={city}
              onChange={(e) => setCity(e.currentTarget.value)}
              placeholder={cityPlaceholder(state)}
              data-testid="checkin-city"
            />
          </Group>
          <Select
            label="Purpose of visit"
            required
            error={isMissing('purposeOfVisit') ? 'Required' : undefined}
            value={purposeOfVisit || 'Leisure'}
            onChange={(v) => setPurposeOfVisit(v ?? 'Leisure')}
            data={PURPOSE_OF_VISIT}
            data-testid="checkin-purpose"
          />
          <Group justify="flex-end">
            <Button color="stayosBrand" loading={isSubmitting === 'guest'} onClick={() => void saveGuestRegistration()} data-testid="checkin-save-guest">Save guest details</Button>
          </Group>
        </Stack>
      </StepCard>

      <StepCard icon={<CreditCard size={17} />} title="Step 3 · Payment plan" complete={c.paymentReviewed}>
        <Stack gap={spacing[3]}>
          <Text c="#64748b" size="sm">
            Confirm how the guest will pay. If dues are pending, collect now or record that payment will be settled at checkout.
          </Text>

          {/* Big, clear billing summary strip */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={spacing[3]}>
            <Paper p={14} radius={radius.md} style={{ background: workspace.payment.outstandingAmount > 0 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${workspace.payment.outstandingAmount > 0 ? '#fdba74' : '#86efac'}` }}>
              <Text c="#64748b" size="xs" fw={700} tt="uppercase">Outstanding</Text>
              <Text fw={900} size="xl" mt={2} c={workspace.payment.outstandingAmount > 0 ? '#c2410c' : '#166534'} data-testid="payment-outstanding">
                ₹{workspace.payment.outstandingAmount.toLocaleString('en-IN')}
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

          {/* Payment method chips — one-click choice */}
          <Stack gap={6}>
            <Text c="#334155" size="xs" fw={800} tt="uppercase">Preferred payment method</Text>
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

          {workspace.payment.outstandingAmount > 0 ? (
            <Alert color="orange" variant="light" icon={<AlertTriangle size={17} />}>
              <Stack gap={6}>
                <Text size="sm" fw={700}>
                  ₹{workspace.payment.outstandingAmount.toLocaleString('en-IN')} outstanding
                </Text>
                <Text size="xs">
                  Collect now via Razorpay / manual, or mark that the guest will settle at checkout, then hit <b>Confirm payment plan</b>.
                </Text>
                <Group gap={8} mt={4}>
                  <Button
                    component={Link}
                    href={`/guest-stay/${workspace.booking.reservationId}`}
                    variant="light"
                    color="stayosBrand"
                    size="xs"
                    leftSection={<CreditCard size={14} />}
                    data-testid="checkin-collect-payment"
                  >
                    Collect payment now →
                  </Button>
                </Group>
              </Stack>
            </Alert>
          ) : (
            <Alert color="green" variant="light" icon={<ShieldCheck size={17} />}>
              <Text size="sm" fw={700}>Fully paid — no dues.</Text>
            </Alert>
          )}

          <Group justify="flex-end">
            <Button color="stayosBrand" loading={isSubmitting === 'payment'} onClick={() => void savePayment()} data-testid="checkin-save-payment">
              Confirm payment plan
            </Button>
          </Group>
        </Stack>
      </StepCard>

      <StepCard icon={<BedDouble size={17} />} title="Step 4 · Room readiness" complete={c.roomReady}>
        <Stack gap={8}>
          <Text size="sm">
            <b>Room {room.roomNumber ?? 'Unassigned'}</b> · {room.roomType ?? '—'} · Status: <b>{room.operationalStatus ?? 'N/A'}</b>
          </Text>
          {room.warnings.length > 0 ? (
            <Alert color="orange" variant="light" icon={<AlertTriangle size={16} />}>
              <Stack gap={4}>
                {room.warnings.map((warning, i) => <Text key={i} size="sm">{warning}</Text>)}
              </Stack>
            </Alert>
          ) : null}
          {!room.roomId ? (
            <Button component={Link} href={`/reservations/${workspace.booking.reservationId}`} variant="light" color="stayosBrand" w="fit-content">Assign a room →</Button>
          ) : !c.roomReady ? (
            <Button component={Link} href={`/rooms`} variant="light" color="stayosBrand" w="fit-content">Open rooms board →</Button>
          ) : null}
        </Stack>
      </StepCard>

      <Card
        radius={radius.lg}
        p={16}
        style={{
          background: c.canCheckIn ? 'linear-gradient(135deg,#7d4dd6 0%,#5b21b6 100%)' : '#f8fafc',
          border: c.canCheckIn ? 'none' : '1px dashed #cbd5e1',
          position: 'sticky',
          bottom: 12,
        }}
      >
        <Group justify="space-between" wrap="wrap" gap={8}>
          <Group gap={10}>
            <ThemeIcon color={c.canCheckIn ? 'white' : 'gray'} variant={c.canCheckIn ? 'white' : 'light'} radius="xl" size={40}>
              <ShieldCheck size={20} color={c.canCheckIn ? '#5b21b6' : '#64748b'} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text c={c.canCheckIn ? '#ffffff' : '#101828'} fw={800}>
                {c.canCheckIn ? 'Ready to check in' : 'Complete the steps above to check in'}
              </Text>
              <Text c={c.canCheckIn ? 'rgba(255,255,255,0.82)' : '#64748b'} size="sm">
                {c.canCheckIn ? 'Guest, ID, payment and room are all set.' : `${c.blockers.length} step${c.blockers.length === 1 ? '' : 's'} pending.`}
              </Text>
            </Stack>
          </Group>
          <Button
            size="lg"
            disabled={!c.canCheckIn}
            loading={isSubmitting === 'complete'}
            onClick={() => void completeCheckIn()}
            variant={c.canCheckIn ? 'white' : 'filled'}
            color={c.canCheckIn ? undefined : 'gray'}
            c={c.canCheckIn ? '#5b21b6' : undefined}
            data-testid="checkin-complete"
          >
            Complete Check-In →
          </Button>
        </Group>
      </Card>

      <SendToPhoneModal
        opened={sendToPhoneOpened}
        onClose={() => setSendToPhoneOpened(false)}
        propertyId={propertyId}
        reservationId={workspace.booking.reservationId}
        frontUploadedInitially={Boolean(workspace.documents.find((d) => d.side === 'ID_FRONT'))}
        backUploadedInitially={Boolean(workspace.documents.find((d) => d.side === 'ID_BACK'))}
        onCaptured={refreshWorkspace}
      />
    </Stack>
  );
}

export default CheckInWorkspacePage;
