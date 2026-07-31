'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Badge, Box, Button, Card, Checkbox, Group, Loader, Paper, Select, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { AlertTriangle, BedDouble, Camera, Check, ChevronLeft, CreditCard, IdCard, ShieldCheck, Trash2, Upload, UserRound, X } from 'lucide-react';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import { getProperties } from '../../lib/guest-api';
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

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.035)',
};

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
  const [propertyId, setPropertyId] = useState('');
  const [workspace, setWorkspace] = useState<CheckInWorkspaceDto | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState<'guest' | 'identity' | 'payment' | 'complete' | 'id-front' | 'id-back' | 'id-delete' | null>(null);

  // Guest form state
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [purposeOfVisit, setPurposeOfVisit] = useState('Leisure');

  // Identity form state
  const [idType, setIdType] = useState<string>('AADHAAR');
  const [idNumber, setIdNumber] = useState('');
  const [idVerified, setIdVerified] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');

  const applyWorkspace = useCallback((next: CheckInWorkspaceDto) => {
    setWorkspace(next);
    setFullName(next.guest.fullName ?? '');
    setMobile(next.guest.mobile ?? '');
    setEmail(next.guest.email ?? '');
    setNationality(next.guest.nationality ?? '');
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
    if (!params.reservationId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const properties = await getProperties(controller.signal);
        const active = properties.find((p) => (typeof p.status === 'string' ? p.status.toUpperCase() : 'ACTIVE') === 'ACTIVE') ?? properties[0];
        const pid = typeof active?.id === 'string' ? active.id : '';
        if (!pid) throw new Error('No active property');
        setPropertyId(pid);
        const ws = await getCheckInWorkspace(pid, params.reservationId, controller.signal);
        applyWorkspace(ws);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load check-in workspace.');
      }
    })();
    return () => controller.abort();
  }, [params.reservationId, applyWorkspace]);

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
            if (detected.idType !== 'OTHER' && detected.idNumber) {
              setIdType(detected.idType);
              setIdNumber(detected.idNumber);
              bits.push(`${detected.idType.replace('_', ' ')}: ${detected.idNumber}`);
            }
            if (detected.fullName && !fullName.trim()) {
              // Only auto-fill the guest name if the receptionist hasn't already picked or typed one.
              setFullName(detected.fullName);
              bits.push(`Name: ${detected.fullName}`);
            } else if (detected.fullName && detected.fullName.toLowerCase() !== fullName.trim().toLowerCase()) {
              // Guest already has a name — don't overwrite, just surface the detected one so front desk can compare.
              bits.push(`ID name: ${detected.fullName}`);
            }
            if (bits.length > 0) {
              showToast({
                color: 'blue',
                title: 'Auto-detected from ID',
                message: `${bits.join(' · ')} — please confirm.`,
              });
            } else {
              showToast({ color: 'yellow', title: 'Could not auto-detect', message: 'Please enter the ID type and number manually.' });
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

  return (
    <Stack gap={spacing[3]}>
      <Group justify="space-between" align="flex-start" gap={spacing[4]}>
        <Stack gap={6}>
          <Button component={Link} href={`/reservations/${workspace.booking.reservationId}`} variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0} w="fit-content">Back to booking</Button>
          <Title order={1} c="#101828" style={{ fontSize: 30, fontWeight: 800 }}>Check-In · {workspace.booking.reservationCode}</Title>
          <Text c="#64748b" size="sm">
            {workspace.guest.fullName || 'Guest'} · {workspace.booking.arrivalDate} → {workspace.booking.departureDate} · Room {room.roomNumber ?? 'Unassigned'} ({room.roomType ?? '—'})
          </Text>
        </Stack>
      </Group>

      <Paper radius={radius.lg} p={12} style={cardStyle}>
        <Group gap={8} wrap="wrap">
          <ChecklistPill ok={c.guestRegistrationComplete} label="Guest registration" />
          <ChecklistPill ok={c.identityVerified} label="Identity verified" />
          <ChecklistPill ok={c.paymentReviewed} label="Payment reviewed" />
          <ChecklistPill ok={c.roomReady} label="Room ready" />
        </Group>
        {blockerMessages.length > 0 ? (
          <Alert mt={12} color="orange" variant="light" icon={<AlertTriangle size={17} />}>
            <Stack gap={4}>
              {blockerMessages.map((msg, i) => <Text key={i} size="sm">{msg}</Text>)}
            </Stack>
          </Alert>
        ) : null}
      </Paper>

      <StepCard icon={<UserRound size={17} />} title="Guest registration" complete={c.guestRegistrationComplete}>
        <Stack gap={spacing[3]}>
          <Group grow>
            <TextInput label="Full name" value={fullName} onChange={(e) => setFullName(e.currentTarget.value)} data-testid="checkin-full-name" />
            <TextInput label="Mobile" value={mobile} onChange={(e) => setMobile(e.currentTarget.value)} data-testid="checkin-mobile" />
          </Group>
          <Group grow>
            <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
            <TextInput label="Nationality" value={nationality} onChange={(e) => setNationality(e.currentTarget.value)} />
          </Group>
          <TextInput label="Address" value={addressLine1} onChange={(e) => setAddressLine1(e.currentTarget.value)} data-testid="checkin-address" />
          <Group grow>
            <TextInput label="City" value={city} onChange={(e) => setCity(e.currentTarget.value)} />
            <TextInput label="State" value={state} onChange={(e) => setState(e.currentTarget.value)} />
            <TextInput label="Country" value={country} onChange={(e) => setCountry(e.currentTarget.value)} />
          </Group>
          <TextInput label="Purpose of visit" value={purposeOfVisit} onChange={(e) => setPurposeOfVisit(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button color="stayosBrand" loading={isSubmitting === 'guest'} onClick={() => void saveGuestRegistration()} data-testid="checkin-save-guest">Save guest details</Button>
          </Group>
        </Stack>
      </StepCard>

      <StepCard icon={<IdCard size={17} />} title="Identity verification" complete={c.identityVerified}>
        <Stack gap={spacing[3]}>
          <Group grow align="stretch">
            <IdPhotoTile
              side="front"
              label="ID front"
              document={workspace.documents.find((d) => d.side === 'ID_FRONT')}
              propertyId={propertyId}
              reservationId={workspace.booking.reservationId}
              onUpload={uploadIdPhoto}
              onDelete={deleteIdPhoto}
              uploading={isSubmitting === 'id-front'}
            />
            <IdPhotoTile
              side="back"
              label="ID back"
              document={workspace.documents.find((d) => d.side === 'ID_BACK')}
              propertyId={propertyId}
              reservationId={workspace.booking.reservationId}
              onUpload={uploadIdPhoto}
              onDelete={deleteIdPhoto}
              uploading={isSubmitting === 'id-back'}
            />
          </Group>
          <Group grow>
            <Select
              label="ID type"
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
            />
            <TextInput
              label={workspace.identity.idNumberMasked ? `ID number (on file: ${workspace.identity.idNumberMasked})` : 'ID number'}
              value={idNumber}
              onChange={(e) => setIdNumber(e.currentTarget.value)}
              rightSection={isDetecting ? <Loader size="xs" color="stayosBrand" /> : undefined}
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

      <StepCard icon={<CreditCard size={17} />} title="Payment review" complete={c.paymentReviewed}>
        <Stack gap={spacing[3]}>
          <Group grow>
            <Paper p={12} radius={radius.md} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
              <Text c="#64748b" size="xs" fw={700}>Status</Text>
              <Text fw={700} size="sm" mt={2}>{workspace.payment.paymentStatus}</Text>
            </Paper>
            <Paper p={12} radius={radius.md} style={{ background: '#f8fafc', border: '1px solid #eef2f7' }}>
              <Text c="#64748b" size="xs" fw={700}>Outstanding</Text>
              <Text fw={700} size="sm" mt={2}>₹{workspace.payment.outstandingAmount.toLocaleString('en-IN')}</Text>
            </Paper>
            <Select
              label="Payment method"
              value={paymentMethod}
              onChange={(v) => setPaymentMethod(v ?? 'CASH')}
              data={[
                { label: 'Cash', value: 'CASH' },
                { label: 'Card', value: 'CARD' },
                { label: 'UPI', value: 'UPI' },
                { label: 'Corporate / BTC', value: 'BTC' },
                { label: 'Prepaid (OTA)', value: 'PREPAID' },
              ]}
            />
          </Group>
          <Group justify="flex-end">
            <Button color="stayosBrand" loading={isSubmitting === 'payment'} onClick={() => void savePayment()} data-testid="checkin-save-payment">Mark payment reviewed</Button>
          </Group>
        </Stack>
      </StepCard>

      <StepCard icon={<BedDouble size={17} />} title="Room readiness" complete={c.roomReady}>
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
    </Stack>
  );
}

export default CheckInWorkspacePage;
