'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Image,
  Loader,
  LoadingOverlay,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  Title,
} from '@mantine/core';
import { showToast } from '@stayos/ui';
import { radius, spacing } from '@stayos/theme';
import {
  BedDouble,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  DoorOpen,
  Eye,
  FileCheck2,
  IdCard,
  Printer,
  QrCode,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  completeCheckIn,
  createMobileCapture,
  deleteIdentityDocument,
  getArray,
  getBoolean,
  getCheckInWorkspace,
  getIdentityDocument,
  getMobileCaptureStatus,
  getNumber,
  getRegistrationCard,
  getRecord,
  getString,
  markPaymentReviewed,
  saveIdentity,
  uploadIdentityDocument,
  type CheckInWorkspaceDto,
  type LooseRecord,
  type MobileCaptureDto,
} from '../../features/check-in/check-in-api';
import { assignRoomToReservation } from '../../lib/reservation-api';
import { getAvailableRooms, type OperationsAvailableRoomDto } from '../../lib/operations-api';
import { useAuth } from '../../features/auth/auth-context';
import styles from './check-in.module.css';

type SectionKey = 'booking' | 'identity' | 'payment' | 'review';
type PendingDocumentState = {
  file: File;
  url: string;
  contentType: string;
};
type PersistedDocumentPreviewState = {
  front?: { url: string; contentType: string };
  back?: { url: string; contentType: string };
};
type CaptureProgress = {
  completed: boolean;
  frontReceived: boolean;
  backReceived: boolean;
  opened: boolean;
};

const sections: Array<{ key: SectionKey; label: string }> = [
  { key: 'booking', label: 'Booking & Room' },
  { key: 'identity', label: 'Guest & Identity' },
  { key: 'payment', label: 'Payment & Readiness' },
  { key: 'review', label: 'Review' },
];

const idTypes = ['Aadhaar', 'Passport', 'Driving Licence', 'Voter ID', 'PAN', 'Other'];
const documentTypeValues: Record<string, string> = {
  Aadhaar: 'AADHAAR',
  Passport: 'PASSPORT',
  'Driving Licence': 'DRIVING_LICENSE',
  'Voter ID': 'VOTER_ID',
  PAN: 'PAN',
  Other: 'OTHER',
};
const documentTypeLabels = Object.fromEntries(Object.entries(documentTypeValues).map(([label, value]) => [value, label]));

function friendlyError(error: unknown, fallback: string) {
  const text = error instanceof Error ? error.message.toLowerCase() : '';
  if (text.includes('expired')) return 'Capture link expired. Generate a new one.';
  if (text.includes('identity')) return "Verify the guest's identity before check-in.";
  if (text.includes('payment')) return 'Review the payment status.';
  if (text.includes('room')) return 'The assigned room is not ready.';
  return fallback;
}

function money(value: unknown) {
  if (typeof value === 'number') return `INR ${value.toLocaleString('en-IN')}`;
  if (typeof value === 'string' && value.trim()) return value;
  return 'INR 0';
}

function mask(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed ? '••••' : 'Not saved';
  return `•••• ${trimmed.slice(-4)}`;
}

function isAadhaarType(value: string) {
  return value.trim().toLowerCase() === 'aadhaar' || value.trim().toUpperCase() === 'AADHAAR';
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function formatAadhaar(value: string) {
  return digitsOnly(value)
    .slice(0, 12)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .trim();
}

function normalizeDocumentType(value: string) {
  return documentTypeValues[value] ?? value.toUpperCase().replace(/\s+/g, '_');
}

function displayDocumentType(value: string) {
  return documentTypeLabels[value] ?? (value || 'Aadhaar');
}

function firstImage(...records: Array<LooseRecord | undefined>) {
  for (const record of records) {
    const url = getString(record, ['previewUrl', 'url', 'fileUrl', 'downloadUrl', 'documentUrl', 'frontUrl', 'backUrl']);
    if (url) return url;
  }
  return '';
}

function documentContentType(record: LooseRecord | undefined) {
  return getString(record, ['contentType', 'mimeType', 'mime', 'fileType']);
}

function isPdfDocument(record: LooseRecord | undefined) {
  const contentType = documentContentType(record).toLowerCase();
  const fileName = getString(record, ['fileName', 'filename', 'name']).toLowerCase();
  return contentType.includes('pdf') || fileName.endsWith('.pdf');
}

function documentId(record: LooseRecord | undefined) {
  return getString(record, ['documentId', 'id', '_id', 'fileId', 'uploadId']);
}

function findDocument(record: LooseRecord | undefined, side: 'front' | 'back') {
  const directKeys = side === 'front' ? ['front', 'frontDocument', 'idFront', 'ID_FRONT'] : ['back', 'backDocument', 'idBack', 'ID_BACK'];
  const direct = getRecord(record, directKeys);
  if (direct) return direct;
  const targetTypes = side === 'front' ? ['ID_FRONT', 'FRONT'] : ['ID_BACK', 'BACK'];
  const documents = getArray(record, ['documents', 'identityDocuments', 'uploads']);
  return documents.find((item) => {
    if (!item || typeof item !== 'object') return false;
    const type = getString(item as LooseRecord, ['type', 'side', 'documentType']).toUpperCase();
    return targetTypes.includes(type);
  }) as LooseRecord | undefined;
}

function hasDocument(record: LooseRecord | undefined, side: 'front' | 'back') {
  if (findDocument(record, side)) return true;
  const urlKeys = side === 'front' ? ['frontUrl', 'front_url', 'idFrontUrl'] : ['backUrl', 'back_url', 'idBackUrl'];
  const flagKeys =
    side === 'front'
      ? ['frontDocumentUploaded', 'documentFrontUploaded']
      : ['backDocumentUploaded', 'documentBackUploaded'];
  return getBoolean(record, flagKeys) || Boolean(getString(record, urlKeys));
}

function isCaptureExpired(status: string) {
  return ['EXPIRED', 'REVOKED', 'CANCELLED', 'CANCELED'].includes(status);
}

function getCaptureProgress(record: LooseRecord | null): CaptureProgress {
  const source = record ?? undefined;
  const status = getString(source, ['status']).toUpperCase();
  const frontReceived = getBoolean(source, ['frontDocumentUploaded', 'documentFrontUploaded', 'frontReceived']);
  const backReceived = getBoolean(source, ['backDocumentUploaded', 'documentBackUploaded', 'backReceived']);
  return {
    completed: status === 'COMPLETED' || getBoolean(source, ['complete', 'completed']) || (frontReceived && backReceived),
    frontReceived,
    backReceived,
    opened: getBoolean(source, ['opened', 'linkOpened', 'visited']),
  };
}

function buildMobileCaptureUrl(capture: MobileCaptureDto | null, origin: string) {
  if (!capture || !origin) return '';
  const capturePath = getString(capture, ['capturePath']);
  if (capturePath) return `${origin}${capturePath}`;
  const provided = getString(capture, ['captureUrl', 'url', 'link']);
  if (provided?.startsWith('/')) return `${origin}${provided}`;
  if (provided) {
    try {
      const parsed = new URL(provided);
      return parsed.pathname.startsWith('/check-in-capture/') ? `${origin}${parsed.pathname}` : provided;
    } catch {
      return '';
    }
  }
  const token = getString(capture, ['captureToken', 'token']);
  return token ? `${origin}/check-in-capture/${token}` : '';
}

function getAssignedRoomValue(record: LooseRecord | undefined, keys: string[]) {
  const value = getString(record, keys);
  return value && value.toLowerCase() !== 'unassigned' ? value : '';
}

function getOptionalBoolean(record: LooseRecord | undefined, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function isAssignableReadyRoom(room: OperationsAvailableRoomDto) {
  const statuses = [room.uiStatus, room.operationalStatus].map((status) => String(status ?? '').toUpperCase());
  const isReady = statuses.includes('READY');
  const isOccupied = statuses.includes('OCCUPIED') || Boolean(room.currentStay);
  return isReady && !isOccupied;
}

function roomOptionLabel(room: OperationsAvailableRoomDto) {
  const roomType = typeof room.roomType === 'object' ? room.roomType.name : '';
  const floor =
    typeof room.floor === 'object'
      ? room.floor.name ?? room.floor.code ?? (room.floor.floorNumber === undefined ? '' : `Floor ${room.floor.floorNumber}`)
      : '';
  return [`Room ${room.roomNumber}`, roomType, floor].filter(Boolean).join(' - ');
}

function Status({ complete, label }: { complete: boolean; label: string }) {
  const Icon = complete ? CheckCircle2 : XCircle;
  return (
    <Group gap={8} wrap="nowrap">
      <Icon size={16} color={complete ? '#16a34a' : '#dc2626'} />
      <Text size="sm" fw={600} c={complete ? '#166534' : '#991b1b'}>
        {label}
      </Text>
    </Group>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Paper p={14} radius={radius.md} className={styles.infoTile}>
      <Text c="#64748b" size="xs" fw={600}>
        {label}
      </Text>
      <Text c="#101828" mt={4} size="sm" fw={700}>
        {value || 'Not recorded'}
      </Text>
    </Paper>
  );
}

function formatDocumentTime(record: LooseRecord | undefined) {
  const value = getString(record, ['uploadedAt', 'createdAt', 'updatedAt', 'capturedAt']);
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short' });
}

function documentSource(record: LooseRecord | undefined) {
  const source = getString(record, ['source', 'uploadSource', 'uploadedVia', 'channel']).toLowerCase();
  if (source.includes('mobile')) return 'Mobile capture';
  if (source.includes('desktop') || source.includes('manual')) return 'Desktop upload';
  return 'Mobile capture';
}

function DocumentReviewCard({
  side,
  document,
  imageUrl,
  isPdf,
  uploaded,
  loading,
  error,
  onUpload,
  onView,
  onRemove,
}: {
  side: 'front' | 'back';
  document?: LooseRecord;
  imageUrl?: string;
  isPdf?: boolean;
  uploaded: boolean;
  loading: boolean;
  error?: boolean;
  onUpload: () => void;
  onView: () => void;
  onRemove?: () => void;
}) {
  const label = side === 'front' ? 'Front of ID' : 'Back of ID';
  const uploadedTime = formatDocumentTime(document);
  return (
    <Paper p={12} radius={radius.md} className={styles.documentReviewCard}>
      <Group justify="space-between" align="flex-start" mb={10}>
        <Box>
          <Text c="#101828" size="sm" fw={800}>
            {label}
          </Text>
          <Text c="#64748b" size="xs" fw={600}>
            {uploaded ? `Uploaded via ${documentSource(document).replace(' capture', '')}${uploadedTime ? ` · ${uploadedTime}` : ''}` : 'Not uploaded'}
          </Text>
        </Box>
        {uploaded ? (
          <Badge color="green" variant="light">
            Uploaded
          </Badge>
        ) : null}
      </Group>
      <button
        type="button"
        className={styles.documentPreviewButton}
        onClick={uploaded && !loading ? onView : onUpload}
        disabled={loading}
        aria-label={uploaded ? `View ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
      >
        {loading ? (
          <Stack align="center" gap={8}>
            <Loader size="sm" />
            <Text size="sm" fw={700} c="#475569">
              Uploading {side} document...
            </Text>
          </Stack>
        ) : imageUrl ? (
          <Image src={imageUrl} alt={`${label} guest identity document`} fit="contain" className={styles.documentReviewImage} />
        ) : isPdf ? (
          <Box className={styles.documentPdfPreview}>PDF document</Box>
        ) : (
          <Stack align="center" gap={8}>
            <Upload size={22} color="#64748b" />
            <Text size="sm" fw={800} c={error ? '#991b1b' : '#475569'}>
              {error ? 'Upload failed.' : `Upload ${side === 'front' ? 'Front' : 'Back'}`}
            </Text>
          </Stack>
        )}
      </button>
      <Group gap={8} mt={12} grow>
        {uploaded ? (
          <Tooltip label={`View ${label}`}>
            <Button variant="light" color="gray" leftSection={<Eye size={15} />} onClick={onView} disabled={loading}>
              View
            </Button>
          </Tooltip>
        ) : null}
        <Tooltip label={uploaded ? `Replace ${label}` : `Upload ${label}`}>
          <Button variant="light" color="gray" leftSection={<RotateCw size={15} />} onClick={onUpload} disabled={loading}>
            {uploaded ? 'Replace' : 'Upload'}
          </Button>
        </Tooltip>
        {uploaded && onRemove ? (
          <Tooltip label={`Remove ${label}`}>
            <Button variant="light" color="red" leftSection={<Trash2 size={15} />} onClick={onRemove} disabled={loading}>
              Remove
            </Button>
          </Tooltip>
        ) : null}
      </Group>
    </Paper>
  );
}

function VerifiedIdentitySummary({
  type,
  number,
  onReview,
}: {
  type: string;
  number: string;
  onReview: () => void;
}) {
  return (
    <Paper p={14} radius={radius.md} className={styles.verifiedIdentitySummary}>
      <Group justify="space-between" align="center">
        <Group gap={10}>
          <ThemeIcon color="green" variant="light">
            <ShieldCheck size={18} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={800} c="#166534">
              {type} · {mask(number)}
            </Text>
            <Text size="xs" c="#64748b" fw={600}>
              Identity verified by receptionist.
            </Text>
          </Box>
        </Group>
        <Button variant="light" color="gray" onClick={onReview}>
          Review Details
        </Button>
      </Group>
    </Paper>
  );
}

function CaptureDialog({
  capture,
  onClose,
  onRefresh,
  propertyId,
  reservationId,
}: {
  capture: MobileCaptureDto | null;
  onClose: () => void;
  onRefresh: () => Promise<unknown>;
  propertyId: string;
  reservationId: string;
}) {
  const [status, setStatus] = useState<MobileCaptureDto | null>(capture);
  const [captureUrl, setCaptureUrl] = useState('');
  const [remaining, setRemaining] = useState('');
  const [completeMessage, setCompleteMessage] = useState(false);
  const [pollError, setPollError] = useState(false);
  const pendingPoll = useRef(false);
  const completionHandled = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const token = getString(capture ?? undefined, ['captureToken', 'token']);
  const statusText = getString(status ?? undefined, ['status']).toUpperCase();
  const expiresAt = getString(status ?? capture ?? undefined, ['expiresAt', 'expires_at']);
  const captureProgress = getCaptureProgress(status);
  const frontReceived = captureProgress.frontReceived;
  const backReceived = captureProgress.backReceived;
  const opened = captureProgress.opened;
  const completed = captureProgress.completed;
  const expired = isCaptureExpired(statusText);
  const bothDocumentsReceived = frontReceived && backReceived;
  const progressLabel = completed
    ? 'ID documents received.'
    : expired
      ? 'This capture link has expired.'
      : backReceived
        ? 'Ready to submit...'
        : frontReceived
          ? 'Waiting for back document...'
          : 'Waiting for mobile upload...';

  useEffect(() => {
    setStatus(capture);
    setCaptureUrl('');
    setCompleteMessage(false);
    setPollError(false);
    completionHandled.current = false;
    if (capture && typeof window !== 'undefined') setCaptureUrl(buildMobileCaptureUrl(capture, window.location.origin));
  }, [capture]);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (
      !token ||
      !capture ||
      !propertyId ||
      !reservationId ||
      completed ||
      bothDocumentsReceived ||
      expired ||
      completionHandled.current
    ) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setInterval(async () => {
      if (pendingPoll.current) return;
      pendingPoll.current = true;
      try {
        const next = await getMobileCaptureStatus(propertyId, reservationId, controller.signal);
        setStatus(next);
        const nextStatus = getString(next, ['status']).toUpperCase();
        const nextProgress = getCaptureProgress(next);
        const nextFrontReceived = nextProgress.frontReceived;
        const nextBackReceived = nextProgress.backReceived;
        const nextCompleted = nextProgress.completed;
        if (process.env.NODE_ENV === 'development') {
          console.info('Mobile capture status:', {
            status: nextStatus,
            frontDocumentUploaded: nextFrontReceived,
            backDocumentUploaded: nextBackReceived,
            completed: nextCompleted,
          });
        }
        if (nextCompleted && !completionHandled.current) {
          completionHandled.current = true;
          window.clearInterval(timer);
          setCompleteMessage(true);
          showToast({
            color: 'green',
            title: 'Mobile capture',
            message: nextFrontReceived && nextBackReceived ? 'ID front and back received.' : 'ID front received. Back document is still required.',
          });
          try {
            await onRefresh();
            showToast({ color: 'green', title: 'Identity documents', message: 'Documents are ready for verification.' });
            closeTimer.current = window.setTimeout(onClose, 1000);
          } catch {
            setPollError(true);
            showToast({
              color: 'yellow',
              title: 'Identity documents',
              message: 'Documents were received, but the workspace could not refresh.',
            });
          }
        }
        if (isCaptureExpired(nextStatus)) {
          window.clearInterval(timer);
        }
      } catch {
        if (!controller.signal.aborted) {
          setPollError(true);
          window.clearInterval(timer);
        }
      } finally {
        pendingPoll.current = false;
      }
    }, 2500);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      pendingPoll.current = false;
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [capture, completed, expired, onClose, onRefresh, propertyId, reservationId, token]);

  async function copyLink() {
    if (!captureUrl) return;
    await navigator.clipboard.writeText(captureUrl);
    showToast({ color: 'green', title: 'Mobile capture', message: 'Mobile capture link copied.' });
  }

  return (
    <Modal opened={Boolean(capture)} onClose={onClose} centered title="Capture Guest ID" size="md">
      <Stack gap={spacing[4]} align="center">
        <Text size="sm" c="#475569" ta="center">
          Scan this QR code using the hotel phone.
        </Text>
        {captureUrl ? (
          <Box className={styles.qrFrame}>
            <QRCodeSVG value={captureUrl} size={240} level="M" includeMargin />
          </Box>
        ) : (
          <Box className={styles.qrSkeleton} />
        )}
        <Text size="sm" fw={700} c={expired ? '#991b1b' : '#334155'}>
          {expired ? 'Expired' : `Expires in ${remaining || 'calculating...'}`}
        </Text>
        <Box w="100%">
          <Text size="xs" fw={700} c="#64748b">
            Open on mobile:
          </Text>
          <Text size="sm" c="#101828" className={styles.captureUrl}>
            {captureUrl}
          </Text>
        </Box>
        <Button variant="light" color="gray" onClick={() => void copyLink()} disabled={!captureUrl}>
          Copy Link
        </Button>
        <Text size="xs" c="#64748b" ta="center">
          Use this only when QR scanning is unavailable.
        </Text>
        <Divider w="100%" />
        <Stack gap={8} w="100%">
          <Text size="sm" fw={800} c={completed ? '#166534' : expired ? '#991b1b' : '#334155'}>
            {completeMessage ? 'ID documents received.' : progressLabel}
          </Text>
          {opened ? <Status label="Link opened" complete /> : null}
          <Status label="Front document received" complete={frontReceived || completed} />
          <Status label="Back document received" complete={backReceived || completed} />
          <Status label="Upload complete" complete={completed || bothDocumentsReceived} />
        </Stack>
        {pollError ? (
          <Alert color="yellow">
            Documents were received, but the workspace could not refresh.
            <Button mt={8} size="xs" variant="light" onClick={() => void onRefresh()}>
              Refresh
            </Button>
          </Alert>
        ) : null}
        <Button variant="subtle" color="gray" onClick={onClose}>
          Cancel Capture
        </Button>
      </Stack>
    </Modal>
  );
}

export default function CheckInPage() {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const reservationParam = searchParams.get('reservationId') ?? searchParams.get('reservation') ?? undefined;
  const propertyId = auth.user?.propertyId ?? '';
  const [workspace, setWorkspace] = useState<CheckInWorkspaceDto | null>(null);
  const [registrationCard, setRegistrationCard] = useState<LooseRecord | null>(null);
  const [active, setActive] = useState<SectionKey>('booking');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assigningRoom, setAssigningRoom] = useState(false);
  const [capture, setCapture] = useState<MobileCaptureDto | null>(null);
  const [rooms, setRooms] = useState<OperationsAvailableRoomDto[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [docType, setDocType] = useState('Aadhaar');
  const [docNumber, setDocNumber] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [completedStayId, setCompletedStayId] = useState('');
  const [pendingDocuments, setPendingDocuments] = useState<Partial<Record<'front' | 'back', PendingDocumentState>>>({});
  const [persistedDocumentPreviews, setPersistedDocumentPreviews] = useState<PersistedDocumentPreviewState>({});
  const [documentActionLoading, setDocumentActionLoading] = useState<Partial<Record<'front' | 'back', boolean>>>({});
  const [documentUploadErrors, setDocumentUploadErrors] = useState<Partial<Record<'front' | 'back', boolean>>>({});
  const [previewSide, setPreviewSide] = useState<'front' | 'back' | null>(null);
  const [removeSide, setRemoveSide] = useState<'front' | 'back' | null>(null);
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const pendingDocumentsRef = useRef(pendingDocuments);
  const persistedDocumentPreviewsRef = useRef(persistedDocumentPreviews);
  const frontInputRef = useRef<HTMLButtonElement | null>(null);
  const backInputRef = useRef<HTMLButtonElement | null>(null);

  const reservation = getRecord(workspace ?? undefined, ['reservation', 'booking']) ?? {};
  const guest = getRecord(workspace ?? undefined, ['guest', 'leadGuest']) ?? {};
  const identity = getRecord(workspace ?? undefined, ['identity']) ?? {};
  const payment = getRecord(workspace ?? undefined, ['payment']) ?? {};
  const readiness = getRecord(workspace ?? undefined, ['readiness', 'roomReadiness']) ?? {};
  const summary = getRecord(workspace ?? undefined, ['summary', 'deskSummary']) ?? {};
  const review = getRecord(workspace ?? undefined, ['review']) ?? {};
  const reviewRoom = getRecord(review, ['room', 'roomSection']) ?? {};
  const assignedRoom =
    getRecord(workspace ?? undefined, ['room', 'assignedRoom', 'assignedRoomDetails']) ??
    getRecord(reservation, ['room', 'assignedRoomDetails', 'assignedRoom']) ??
    getRecord(summary, ['room', 'assignedRoom', 'assignedRoomDetails']) ??
    getRecord(reviewRoom, ['room', 'assignedRoom', 'assignedRoomDetails']) ??
    getRecord(readiness, ['room', 'assignedRoom']) ??
    {};
  const card =
    registrationCard ??
    getRecord(workspace ?? undefined, ['registrationCard', 'registration_card']) ??
    workspace ??
    {};
  const reservationId = getString(reservation, ['id', 'reservationId'], reservationParam ?? '');
  const guestName = getString(guest, ['fullName', 'name'], getString(reservation, ['guestName', 'guest'], 'Guest'));
  const assignedRoomId =
    getAssignedRoomValue(assignedRoom, ['roomId', 'id', '_id', 'uuid']) ||
    getAssignedRoomValue(reservation, ['roomId', 'assignedRoomId']) ||
    getAssignedRoomValue(summary, ['roomId', 'assignedRoomId']) ||
    getAssignedRoomValue(readiness, ['roomId', 'assignedRoomId']);
  const roomNumber =
    getAssignedRoomValue(assignedRoom, ['roomNumber', 'number', 'displayName', 'name']) ||
    getAssignedRoomValue(summary, ['roomNumber', 'assignedRoom', 'assignedRoomLabel']) ||
    getAssignedRoomValue(reviewRoom, ['roomNumber', 'assignedRoom', 'assignedRoomLabel']) ||
    getAssignedRoomValue(readiness, ['roomNumber', 'assignedRoom']) ||
    getAssignedRoomValue(reservation, ['roomNumber', 'assignedRoom', 'assignedRoomLabel']) ||
    (assignedRoomId ? 'Assigned' : 'Unassigned');
  const roomType =
    getAssignedRoomValue(assignedRoom, ['roomType', 'type', 'roomTypeName']) ||
    getAssignedRoomValue(summary, ['roomType', 'roomTypeName']) ||
    getAssignedRoomValue(reviewRoom, ['roomType', 'roomTypeName']) ||
    getAssignedRoomValue(reservation, ['roomType', 'roomTypeName']);
  const roomFloor =
    getAssignedRoomValue(assignedRoom, ['floor', 'floorNumber']) ||
    getAssignedRoomValue(summary, ['floor', 'floorNumber']) ||
    getAssignedRoomValue(reviewRoom, ['floor', 'floorNumber']) ||
    getAssignedRoomValue(readiness, ['floor', 'floorNumber']);
  const roomStatus =
    getAssignedRoomValue(assignedRoom, ['status', 'operationalStatus', 'housekeepingStatus']) ||
    getAssignedRoomValue(summary, ['roomStatus', 'status']) ||
    getAssignedRoomValue(reviewRoom, ['roomStatus', 'status']) ||
    getAssignedRoomValue(readiness, ['roomStatus', 'status']);
  const blockers = getArray(workspace ?? undefined, ['blockers', 'checkInBlockers']).map(String);
  const identityVerified = getBoolean(identity, ['verified', 'isVerified']);
  const paymentReviewed = getBoolean(payment, ['reviewed', 'paymentReviewed']) || getString(payment, ['status']).toLowerCase() === 'paid';
  const roomReadyFlag = getOptionalBoolean(readiness, ['ready', 'roomReady']);
  const roomReady = roomReadyFlag ?? roomStatus.toUpperCase() === 'READY';
  const housekeepingClear = getOptionalBoolean(readiness, ['housekeepingClear']);
  const maintenanceClear = getOptionalBoolean(readiness, ['maintenanceClear']);
  const hasHousekeepingBlocker =
    housekeepingClear === false ||
    blockers.some((blocker) => blocker.toLowerCase().includes('housekeeping'));
  const hasMaintenanceBlocker =
    maintenanceClear === false ||
    blockers.some((blocker) => blocker.toLowerCase().includes('maintenance'));
  const hasAssignedRoom = Boolean(assignedRoomId || roomNumber !== 'Unassigned');
  const canCheckIn = getBoolean(
    workspace ?? undefined,
    ['canCheckIn'],
    hasAssignedRoom && roomReady && !hasHousekeepingBlocker && !hasMaintenanceBlocker && blockers.length === 0,
  );
  const readinessLabel = !hasAssignedRoom
    ? 'Room Assignment Required'
    : hasMaintenanceBlocker
      ? 'Maintenance Blocked'
      : hasHousekeepingBlocker || !roomReady
        ? 'Waiting for Housekeeping'
        : canCheckIn
          ? 'READY TO CHECK-IN'
          : 'Blockers Open';
  const readinessColor = readinessLabel === 'READY TO CHECK-IN' ? 'green' : readinessLabel === 'Maintenance Blocked' ? 'red' : 'yellow';
  const readyRoomOptions = useMemo(
    () =>
      rooms
        .filter((room) => isAssignableReadyRoom(room))
        .filter((room) => room.roomId !== assignedRoomId && room.roomNumber !== roomNumber)
        .map((room) => ({ label: roomOptionLabel(room), value: room.roomId })),
    [assignedRoomId, roomNumber, rooms],
  );
  const frontDoc = findDocument(workspace ?? undefined, 'front') ?? findDocument(identity, 'front');
  const backDoc = findDocument(workspace ?? undefined, 'back') ?? findDocument(identity, 'back');
  const frontDocumentId = documentId(frontDoc);
  const backDocumentId = documentId(backDoc);
  const frontUploaded = hasDocument(identity, 'front') || hasDocument(workspace ?? undefined, 'front');
  const backUploaded = hasDocument(identity, 'back') || hasDocument(workspace ?? undefined, 'back');
  const documentsUploaded = frontUploaded || backUploaded;
  const bothDocumentsUploaded = frontUploaded && backUploaded;
  const identityStatus = identityVerified
    ? { label: 'Verified', color: 'green', message: 'Identity verified by receptionist.' }
    : getString(identity, ['status']).toUpperCase() === 'REJECTED'
        ? { label: 'Needs attention', color: 'red', message: 'One or more document images must be replaced.' }
        : bothDocumentsUploaded
          ? { label: 'Awaiting verification', color: 'yellow', message: 'Documents received. Compare them with the original ID.' }
          : { label: 'Awaiting documents', color: 'gray', message: 'Front and back images are required.' };
  const documentUploadRequired = getBoolean(identity, ['documentUploadRequired', 'requiresDocumentUpload', 'requiresDocument'], false);
  const aadhaarSelected = isAadhaarType(docType);
  const aadhaarDigits = digitsOnly(docNumber);
  const documentNumberValid = aadhaarSelected ? aadhaarDigits.length === 12 : Boolean(docNumber.trim());
  const documentMutationInProgress = Boolean(documentActionLoading.front || documentActionLoading.back);
  const canVerifyIdentity = Boolean(docType && documentNumberValid && confirmed && (!documentUploadRequired || bothDocumentsUploaded) && !documentMutationInProgress);
  const previewDocument = previewSide === 'front' ? frontDoc : previewSide === 'back' ? backDoc : undefined;
  const previewImageUrl =
    previewSide === 'front'
      ? firstImage(frontDoc) || persistedDocumentPreviews.front?.url || pendingDocuments.front?.url || ''
      : previewSide === 'back'
        ? firstImage(backDoc) || persistedDocumentPreviews.back?.url || pendingDocuments.back?.url || ''
        : '';
  const previewIsPdf =
    previewSide === 'front'
      ? isPdfDocument(frontDoc) || persistedDocumentPreviews.front?.contentType.includes('pdf') || pendingDocuments.front?.contentType === 'application/pdf'
      : previewSide === 'back'
        ? isPdfDocument(backDoc) || persistedDocumentPreviews.back?.contentType.includes('pdf') || pendingDocuments.back?.contentType === 'application/pdf'
        : false;

  const refreshWorkspace = useCallback(async () => {
    if (!propertyId || !reservationParam) throw new Error('Missing property or reservation.');
    const data = await getCheckInWorkspace(propertyId, reservationParam);
    setWorkspace(data);
    setRegistrationCard(await getRegistrationCard(propertyId, reservationParam).catch(() => null));
    const nextIdentity = getRecord(data, ['identity']);
    const nextDocumentType = getString(nextIdentity, ['documentType', 'idType'], 'Aadhaar');
    const nextDisplayDocumentType = displayDocumentType(nextDocumentType);
    const nextDocumentNumber = getString(nextIdentity, ['documentNumber', 'idNumber']);
    setDocType(nextDisplayDocumentType);
    setDocNumber(isAadhaarType(nextDisplayDocumentType) ? formatAadhaar(nextDocumentNumber) : nextDocumentNumber);
    return data;
  }, [propertyId, reservationParam]);

  const loadWorkspace = useCallback(async () => {
    if (!reservationParam) {
      setWorkspace(null);
      setRegistrationCard(null);
      setLoading(false);
      return;
    }
    if (!propertyId) return;
    setLoading(true);
    try {
      await refreshWorkspace();
    } catch (error) {
      showToast({ color: 'red', title: 'Check-in unavailable', message: friendlyError(error, 'Check-in could not be loaded.') });
    } finally {
      setLoading(false);
    }
  }, [propertyId, refreshWorkspace, reservationParam]);

  useEffect(() => {
    if (auth.isBootstrapping) return;
    void loadWorkspace();
  }, [auth.isBootstrapping, loadWorkspace]);

  useEffect(() => {
    pendingDocumentsRef.current = pendingDocuments;
  }, [pendingDocuments]);

  useEffect(() => {
    persistedDocumentPreviewsRef.current = persistedDocumentPreviews;
  }, [persistedDocumentPreviews]);

  useEffect(() => {
    return () => {
      Object.values(pendingDocumentsRef.current).forEach((document) => {
        if (document?.url) URL.revokeObjectURL(document.url);
      });
      Object.values(persistedDocumentPreviewsRef.current).forEach((document) => {
        if (document?.url) URL.revokeObjectURL(document.url);
      });
    };
  }, []);

  useEffect(() => {
    if (!propertyId || !reservationId) return;
    const sides: Array<{ side: 'front' | 'back'; id: string; hasDirectUrl: boolean }> = [
      { side: 'front', id: frontDocumentId, hasDirectUrl: Boolean(firstImage(frontDoc)) },
      { side: 'back', id: backDocumentId, hasDirectUrl: Boolean(firstImage(backDoc)) },
    ];
    const missingPreviews = sides.filter(({ id, hasDirectUrl }) => id && !hasDirectUrl);
    if (missingPreviews.length === 0) return;

    const controllers = new Map<'front' | 'back', AbortController>();
    let cancelled = false;

    missingPreviews.forEach(({ side, id }) => {
      const controller = new AbortController();
      controllers.set(side, controller);
      getIdentityDocument(propertyId, reservationId, id, controller.signal)
        .then(({ blob, contentType }) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setPersistedDocumentPreviews((current) => {
            if (current[side]?.url) URL.revokeObjectURL(current[side].url);
            return { ...current, [side]: { url, contentType } };
          });
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.warn('Document preview unavailable', error);
        });
    });

    return () => {
      cancelled = true;
      controllers.forEach((controller) => controller.abort());
    };
  }, [backDoc, backDocumentId, frontDoc, frontDocumentId, propertyId, reservationId]);

  async function handleMobileCapture() {
    if (!propertyId || !reservationId) return;
    try {
      setCapture(await createMobileCapture(propertyId, reservationId));
    } catch (error) {
      showToast({ color: 'red', title: 'Mobile capture', message: friendlyError(error, 'Unable to create mobile capture link.') });
    }
  }

  async function stageDocument(side: 'front' | 'back', file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      showToast({ color: 'red', title: 'Invalid file', message: 'Document upload failed. Try again.' });
      return;
    }
    const nextDocument = { file, url: URL.createObjectURL(file), contentType: file.type };
    setPendingDocuments((current) => {
      if (current[side]?.url) URL.revokeObjectURL(current[side].url);
      return { ...current, [side]: nextDocument };
    });
    if (!propertyId || !reservationId) return;
    const replacing = side === 'front' ? frontUploaded : backUploaded;
    setDocumentActionLoading((current) => ({ ...current, [side]: true }));
    setDocumentUploadErrors((current) => ({ ...current, [side]: false }));
    try {
      await uploadIdentityDocument(propertyId, reservationId, side, file);
      showToast({
        color: 'green',
        title: 'Identity documents',
        message: `${side === 'front' ? 'Front' : 'Back'} document ${replacing ? 'replaced' : 'uploaded'}.`,
      });
      if (identityVerified && replacing) {
        showToast({
          color: 'yellow',
          title: 'Identity verification',
          message: 'Identity must be verified again after replacing the document.',
        });
      }
      await loadWorkspace();
    } catch (error) {
      setDocumentUploadErrors((current) => ({ ...current, [side]: true }));
      showToast({ color: 'red', title: 'Upload failed', message: friendlyError(error, 'Document upload failed. Try again.') });
    } finally {
      setDocumentActionLoading((current) => ({ ...current, [side]: false }));
      setPendingDocuments((current) => {
        if (current[side]?.url) URL.revokeObjectURL(current[side].url);
        const next = { ...current };
        delete next[side];
        return next;
      });
    }
  }

  async function removeDocument(side: 'front' | 'back') {
    const id = side === 'front' ? frontDocumentId : backDocumentId;
    if (!propertyId || !reservationId || !id) return;
    setDocumentActionLoading((current) => ({ ...current, [side]: true }));
    try {
      await deleteIdentityDocument(propertyId, reservationId, id);
      showToast({
        color: 'green',
        title: 'Identity documents',
        message: `${side === 'front' ? 'Front' : 'Back'} document removed.`,
      });
      if (identityVerified) {
        showToast({
          color: 'yellow',
          title: 'Identity verification',
          message: 'Identity requires verification again.',
        });
      }
      await loadWorkspace();
    } catch (error) {
      showToast({ color: 'red', title: 'Remove failed', message: friendlyError(error, 'Upload failed. Try again.') });
    } finally {
      setDocumentActionLoading((current) => ({ ...current, [side]: false }));
      setRemoveSide(null);
      if (previewSide === side) setPreviewSide(null);
    }
  }

  async function handleVerify() {
    if (!propertyId || !reservationId || !documentNumberValid || !confirmed) return;
    try {
      await saveIdentity(propertyId, reservationId, {
        idType: normalizeDocumentType(docType),
        idNumber: aadhaarSelected ? aadhaarDigits : docNumber.trim(),
        verified: true,
      });
      showToast({ color: 'green', title: 'Identity verified', message: 'Identity verified by receptionist.' });
      await loadWorkspace();
    } catch (error) {
      showToast({ color: 'red', title: 'Identity', message: friendlyError(error, "Verify the guest's identity before check-in.") });
    }
  }

  async function handlePaymentReviewed() {
    if (!propertyId || !reservationId) return;
    try {
      await markPaymentReviewed(propertyId, reservationId);
      showToast({ color: 'green', title: 'Payment reviewed', message: 'Payment status reviewed.' });
      await loadWorkspace();
    } catch (error) {
      showToast({ color: 'red', title: 'Payment', message: friendlyError(error, 'Review the payment status.') });
    }
  }

  async function handleComplete() {
    if (!propertyId || !reservationId || submitting) return;
    setSubmitting(true);
    try {
      const result = await completeCheckIn(propertyId, reservationId);
      const stayId = getString(result, ['stayId', 'id']);
      showToast({ color: 'green', title: 'Check-in complete', message: `${guestName} checked in to Room ${roomNumber}.` });
      setCompletedStayId(stayId);
      await loadWorkspace();
    } catch (error) {
      showToast({ color: 'red', title: 'Check-in failed', message: friendlyError(error, 'Check-in could not be completed.') });
    } finally {
      setSubmitting(false);
    }
  }

  async function loadRooms() {
    if (!propertyId) return;
    const available = await getAvailableRooms(propertyId, {
      arrivalDate: getString(reservation, ['arrivalDate', 'arrival']),
      departureDate: getString(reservation, ['departureDate', 'departure']),
      guestCount: getNumber(reservation, ['adults'], 1) + getNumber(reservation, ['children'], 0),
    });
    setRooms(available);
  }

  async function assignRoom() {
    if (!propertyId || !reservationId || !selectedRoom || assigningRoom) return;
    const selectedRoomNumber = rooms.find((room) => room.roomId === selectedRoom)?.roomNumber ?? selectedRoom;
    setAssigningRoom(true);
    setLoading(true);
    try {
      await assignRoomToReservation(propertyId, reservationId, selectedRoom);
    } catch {
      showToast({ color: 'red', title: 'Room assignment', message: 'Only ready, unoccupied rooms can be assigned.' });
      setLoading(false);
      setAssigningRoom(false);
      return;
    }

    try {
      showToast({ color: 'green', title: 'Room assigned', message: `Room ${selectedRoomNumber} assigned successfully.` });
      await refreshWorkspace();
      setSelectedRoom(null);
    } catch {
      showToast({
        color: 'yellow',
        title: 'Room assigned successfully.',
        message: 'Unable to refresh the workspace. Please click Refresh.',
      });
    } finally {
      setLoading(false);
      setAssigningRoom(false);
    }
  }

  function printCard() {
    window.print();
  }

  return (
    <Box className={styles.workspaceShell}>
      <LoadingOverlay visible={loading} />
      <Box className={styles.printCard}>
        <Title order={1}>StayOS / {getString(card, ['propertyName'], 'Property Name')}</Title>
        <Title order={2}>Guest Registration Card</Title>
        {[
          ['Guest name', guestName],
          ['Nationality', getString(guest, ['nationality'], 'Not recorded')],
          ['Masked ID', mask(getString(identity, ['documentNumber', 'idNumber']))],
          ['Address', getString(guest, ['addressSummary', 'address'], 'Not recorded')],
          ['Arrival / Departure', `${getString(reservation, ['arrivalDate', 'arrival'])} - ${getString(reservation, ['departureDate', 'departure'])}`],
          ['Room', roomNumber],
          ['Adults / Children', `${getNumber(reservation, ['adults'], 1)} / ${getNumber(reservation, ['children'], 0)}`],
          ['Payment method', getString(payment, ['method', 'paymentMethod'], 'Not recorded')],
        ].map(([label, value]) => (
          <p key={label}>
            <strong>{label}:</strong> {value}
          </p>
        ))}
        <p>I agree to the property terms and confirm that the details above are correct.</p>
        <div className={styles.signatureGrid}>
          <span>Guest signature</span>
          <span>Receptionist</span>
          <span>Date / time</span>
        </div>
      </Box>

      <Group justify="space-between" align="flex-start" mb={spacing[5]} className={styles.noPrint}>
        <Box>
          <Button component={Link} href="/" variant="subtle" color="gray" leftSection={<ChevronLeft size={16} />} px={0}>
            Back to Front Desk
          </Button>
          <Title order={1} c="#101828" mt={8}>
            Check-in Workspace
          </Title>
          <Text c="#64748b" size="sm">
            {guestName} · {getString(reservation, ['reservationCode', 'code'], reservationId || 'Reservation')}
          </Text>
        </Box>
        <Group>
          <Button variant="light" color="gray" leftSection={<RefreshCw size={16} />} onClick={() => void loadWorkspace()} disabled={!reservationParam}>
            Refresh
          </Button>
          <Button variant="light" color="stayosBrand" leftSection={<Printer size={16} />} onClick={printCard}>
            Print Registration Card
          </Button>
        </Group>
      </Group>

      {!reservationParam ? (
        <Alert color="yellow" title="Select a reservation" className={styles.noPrint} mb={spacing[4]}>
          Open check-in from a reservation or booking so StayOS can load the correct workspace.
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[4]} className={styles.noPrint}>
        <Paper p={14} radius={radius.lg} className={styles.sectionRail} style={{ gridColumn: 'span 3' }}>
          <Stack gap={8}>
            {sections.map((section) => (
              <Button
                key={section.key}
                justify="space-between"
                variant={active === section.key ? 'filled' : 'subtle'}
                color={active === section.key ? 'stayosBrand' : 'gray'}
                onClick={() => setActive(section.key)}
              >
                {section.label}
              </Button>
            ))}
          </Stack>
        </Paper>

        <Paper p={20} radius={radius.lg} className={styles.workspaceCard} style={{ gridColumn: 'span 6' }}>
          {active === 'booking' ? (
            <Stack gap={spacing[4]}>
              <Group gap={10}>
                <ThemeIcon color="stayosBrand" variant="light"><BedDouble size={18} /></ThemeIcon>
                <Title order={2}>Booking & Room</Title>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <Tile label="Guest name" value={guestName} />
                <Tile label="Reservation code" value={getString(reservation, ['reservationCode', 'code'], reservationId)} />
                <Tile label="Arrival" value={getString(reservation, ['arrivalDate', 'arrival'])} />
                <Tile label="Departure" value={getString(reservation, ['departureDate', 'departure'])} />
                <Tile label="Adults / Children" value={`${getNumber(reservation, ['adults'], 1)} / ${getNumber(reservation, ['children'], 0)}`} />
                <Tile label="Room type" value={roomType} />
                <Tile label="Assigned room" value={roomNumber} />
                <Tile label="Floor" value={roomFloor} />
                <Tile label="Room status" value={roomStatus} />
                <Tile label="Room readiness" value={roomReady ? 'Ready' : getString(readiness, ['blocker', 'status'], 'Not ready')} />
              </SimpleGrid>
              <Tile label="Special requests" value={getArray(reservation, ['specialRequests', 'requests']).join(', ') || 'No special requests'} />
              <Paper p={14} radius={radius.md} bg="#f8fafc">
                <Group align="end">
                  <Select
                    label={hasAssignedRoom ? 'Change Room' : 'Assign Room'}
                    data={readyRoomOptions}
                    description="Only ready, unoccupied rooms are available for assignment."
                    nothingFoundMessage="No ready unoccupied rooms available"
                    onDropdownOpen={() => void loadRooms()}
                    onChange={setSelectedRoom}
                    value={selectedRoom}
                  />
                  <Button onClick={assignRoom} disabled={!selectedRoom || assigningRoom} loading={assigningRoom}>
                    {assigningRoom ? 'Assigning room...' : hasAssignedRoom ? 'Change Room' : 'Assign Room'}
                  </Button>
                </Group>
              </Paper>
            </Stack>
          ) : null}

          {active === 'identity' ? (
            <Stack gap={spacing[4]}>
              <Group gap={10}>
                <ThemeIcon color="stayosBrand" variant="light"><IdCard size={18} /></ThemeIcon>
                <Title order={2}>Guest & Identity</Title>
              </Group>
              <Title order={3} size="h4">Guest Summary</Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <Tile label="Full name" value={guestName} />
                <Tile label="Phone" value={getString(guest, ['phone', 'mobile'])} />
                <Tile label="Email" value={getString(guest, ['email'])} />
                <Tile label="Nationality" value={getString(guest, ['nationality'], 'Indian')} />
                <Tile label="Address" value={getString(guest, ['addressSummary', 'address'])} />
              </SimpleGrid>
              <Divider />
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Group gap={8}>
                    <Title order={3} size="h4">Identity Documents</Title>
                    <Badge color={identityStatus.color} variant="light">
                      {identityStatus.label}
                    </Badge>
                  </Group>
                  <Text c="#64748b" size="sm" mt={4}>
                    Capture or upload a clear image of the guest's identity document.
                  </Text>
                </Box>
                <Group gap={8}>
                  <Button
                    leftSection={<QrCode size={16} />}
                    onClick={handleMobileCapture}
                    variant={documentsUploaded ? 'light' : 'filled'}
                    disabled={documentMutationInProgress}
                  >
                    {!documentsUploaded ? 'Capture ID using Mobile' : bothDocumentsUploaded ? 'Recapture Documents' : 'Capture Missing Side'}
                  </Button>
                </Group>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <Box>
                  <FileInput
                    ref={frontInputRef}
                    className={styles.hiddenFileInput}
                    accept="image/*,application/pdf"
                    onChange={(file) => void stageDocument('front', file)}
                  />
                  <DocumentReviewCard
                    side="front"
                    document={frontDoc}
                    uploaded={frontUploaded}
                    loading={Boolean(documentActionLoading.front)}
                    error={Boolean(documentUploadErrors.front)}
                    imageUrl={
                      pendingDocuments.front?.contentType.startsWith('image/')
                        ? pendingDocuments.front.url
                        : firstImage(frontDoc) || (frontUploaded && persistedDocumentPreviews.front?.contentType.startsWith('image/') ? persistedDocumentPreviews.front.url : '')
                    }
                    isPdf={pendingDocuments.front?.contentType === 'application/pdf' || (!pendingDocuments.front && (isPdfDocument(frontDoc) || persistedDocumentPreviews.front?.contentType.includes('pdf')))}
                    onUpload={() => frontInputRef.current?.click()}
                    onView={() => setPreviewSide('front')}
                    onRemove={frontDocumentId ? () => setRemoveSide('front') : undefined}
                  />
                </Box>
                <Box>
                  <FileInput
                    ref={backInputRef}
                    className={styles.hiddenFileInput}
                    accept="image/*,application/pdf"
                    onChange={(file) => void stageDocument('back', file)}
                  />
                  <DocumentReviewCard
                    side="back"
                    document={backDoc}
                    uploaded={backUploaded}
                    loading={Boolean(documentActionLoading.back)}
                    error={Boolean(documentUploadErrors.back)}
                    imageUrl={
                      pendingDocuments.back?.contentType.startsWith('image/')
                        ? pendingDocuments.back.url
                        : firstImage(backDoc) || (backUploaded && persistedDocumentPreviews.back?.contentType.startsWith('image/') ? persistedDocumentPreviews.back.url : '')
                    }
                    isPdf={pendingDocuments.back?.contentType === 'application/pdf' || (!pendingDocuments.back && (isPdfDocument(backDoc) || persistedDocumentPreviews.back?.contentType.includes('pdf')))}
                    onUpload={() => backInputRef.current?.click()}
                    onView={() => setPreviewSide('back')}
                    onRemove={backDocumentId ? () => setRemoveSide('back') : undefined}
                  />
                </Box>
              </SimpleGrid>
              <Alert color={identityStatus.color} variant="light">
                {identityStatus.message}
              </Alert>
              <Divider />
              <Title order={3} size="h4">Verify Identity</Title>
              {identityVerified && !showVerificationForm ? (
                <VerifiedIdentitySummary
                  type={displayDocumentType(getString(identity, ['documentType', 'idType'], docType))}
                  number={getString(identity, ['documentNumber', 'idNumber'], docNumber)}
                  onReview={() => setShowVerificationForm(true)}
                />
              ) : (
                <>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                    <Select
                      label="Document type"
                      data={idTypes}
                      value={docType}
                      onChange={(value) => {
                        const nextType = value ?? 'Aadhaar';
                        setDocType(nextType);
                        setDocNumber(isAadhaarType(nextType) ? formatAadhaar(docNumber) : docNumber);
                      }}
                    />
                    <TextInput
                      label="Document number"
                      value={docNumber}
                      inputMode={aadhaarSelected ? 'numeric' : undefined}
                      maxLength={aadhaarSelected ? 14 : undefined}
                      placeholder={aadhaarSelected ? '1234 5678 9012' : undefined}
                      error={aadhaarSelected && docNumber ? (documentNumberValid ? undefined : 'Aadhaar must be 12 digits.') : undefined}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setDocNumber(aadhaarSelected ? formatAadhaar(value) : value);
                      }}
                    />
                  </SimpleGrid>
                  <Checkbox label="I compared the guest with the original document." checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} />
                  <Group justify="flex-end">
                    <Button
                      color="stayosBrand"
                      leftSection={<ShieldCheck size={16} />}
                      onClick={handleVerify}
                      disabled={!canVerifyIdentity}
                    >
                      {identityVerified ? 'Re-verify Identity' : 'Mark Identity Verified'}
                    </Button>
                  </Group>
                </>
              )}
              <Group justify="space-between">
                <Badge color={identityStatus.color} variant="light">
                  {identityStatus.label}
                </Badge>
              </Group>
            </Stack>
          ) : null}

          {active === 'payment' ? (
            <Stack gap={spacing[4]}>
              <Group gap={10}>
                <ThemeIcon color="stayosBrand" variant="light"><CreditCard size={18} /></ThemeIcon>
                <Title order={2}>Payment & Readiness</Title>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <Tile label="Payment status" value={getString(payment, ['status'], 'Not recorded')} />
                <Tile label="Outstanding amount" value={money(payment.outstandingAmount ?? payment.balance)} />
                <Tile label="Method" value={getString(payment, ['method', 'paymentMethod'])} />
                <Tile label="Payment reviewed" value={paymentReviewed ? 'Reviewed' : 'Pending'} />
              </SimpleGrid>
              <Button w="fit-content" onClick={handlePaymentReviewed}>Mark Payment Reviewed</Button>
              <Divider label="Room readiness" labelPosition="left" />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
                <Status label="Room assigned" complete={hasAssignedRoom} />
                <Status label="Housekeeping clear" complete={!hasHousekeepingBlocker} />
                <Status label="Maintenance clear" complete={!hasMaintenanceBlocker} />
                <Status label="Not occupied" complete={getBoolean(readiness, ['notOccupied'])} />
                <Status label="Ready" complete={roomReady} />
              </SimpleGrid>
              {!roomReady ? <Alert color="red">{getString(readiness, ['blocker', 'message'], 'The assigned room is not ready.')}</Alert> : null}
            </Stack>
          ) : null}

          {active === 'review' ? (
            <Stack gap={spacing[4]}>
              <Group gap={10}>
                <ThemeIcon color="stayosBrand" variant="light"><FileCheck2 size={18} /></ThemeIcon>
                <Title order={2}>Review</Title>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
                <Status label="Booking confirmed" complete />
                <Status label="Guest details complete" complete={Boolean(guestName)} />
                <Status label="Identity verified" complete={identityVerified} />
                <Status label="Required documents uploaded" complete={documentsUploaded} />
                <Status label="Payment reviewed" complete={paymentReviewed} />
                <Status label="Room ready" complete={roomReady} />
                <Status label="Check-in readiness" complete={canCheckIn} />
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                <Tile label="Room number" value={roomNumber} />
                <Tile label="Room type" value={roomType} />
                <Tile label="Floor" value={roomFloor} />
                <Tile label="Room status" value={roomStatus} />
              </SimpleGrid>
              {blockers.length ? (
                <Alert color="red" title="Check-in blockers">
                  <Stack gap={4}>{blockers.map((blocker) => <Text key={blocker} size="sm">{blocker}</Text>)}</Stack>
                </Alert>
              ) : null}
              <Group justify="flex-end">
                {completedStayId ? (
                  <Button component={Link} href={`/guest-stay/${completedStayId}`} variant="light" color="stayosBrand">
                    Open Stay
                  </Button>
                ) : null}
                <Button variant="light" color="gray" leftSection={<Printer size={16} />} onClick={printCard}>Print Registration Card</Button>
                <Button leftSection={<DoorOpen size={16} />} disabled={!canCheckIn} loading={submitting} onClick={handleComplete}>
                  Complete Check-in
                </Button>
              </Group>
            </Stack>
          ) : null}
        </Paper>

        <Stack gap={spacing[3]} style={{ gridColumn: 'span 3' }}>
          <Paper p={16} radius={radius.lg} className={styles.workspaceCard}>
            <Text fw={800} c="#101828">Desk Summary</Text>
            <Divider my={spacing[3]} />
            <Stack gap={spacing[2]}>
              <Text fw={800}>{guestName}</Text>
              <Text size="sm" c="#64748b">{getString(reservation, ['reservationCode', 'code'], reservationId)}</Text>
              <Text size="sm" c="#64748b">{hasAssignedRoom ? `Room ${roomNumber}` : 'Room Unassigned'}</Text>
              <Badge color={readinessColor} variant="light" w="fit-content">{readinessLabel}</Badge>
            </Stack>
          </Paper>
          <Paper p={16} radius={radius.lg} className={styles.workspaceCard}>
            <Text fw={800} c="#101828">Exact Blockers</Text>
            <Stack mt={12} gap={8}>
              {(blockers.length ? blockers : ['No backend blockers returned.']).map((blocker) => (
                <Text key={blocker} size="sm" c={blockers.length ? '#991b1b' : '#166534'} fw={600}>{blocker}</Text>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </SimpleGrid>

      <CaptureDialog
        capture={capture}
        onClose={() => setCapture(null)}
        onRefresh={loadWorkspace}
        propertyId={propertyId}
        reservationId={reservationId}
      />
      <Modal
        opened={Boolean(previewSide)}
        onClose={() => setPreviewSide(null)}
        centered
        size="xl"
        title={previewSide === 'front' ? 'Front of ID' : previewSide === 'back' ? 'Back of ID' : 'Identity document'}
      >
        <Stack gap={spacing[3]}>
          <Box className={styles.documentPreviewModalBody}>
            {previewImageUrl && !previewIsPdf ? (
              <Image
                src={previewImageUrl}
                alt={`${previewSide === 'front' ? 'Front' : 'Back'} of guest identity document`}
                fit="contain"
                className={styles.documentPreviewModalImage}
              />
            ) : previewIsPdf ? (
              <Box className={styles.documentPdfPreview}>PDF document preview</Box>
            ) : (
              <Box className={styles.documentEmptyPreview}>Preview unavailable</Box>
            )}
          </Box>
          <Group justify="space-between">
            <Box>
              <Text size="sm" fw={700} c="#101828">
                Uploaded via {documentSource(previewDocument)}
              </Text>
              <Text size="xs" c="#64748b">
                {formatDocumentTime(previewDocument) || 'Upload time not provided'}
              </Text>
            </Box>
            <Group gap={8}>
              <Button variant="light" color="gray" onClick={() => (previewSide === 'front' ? frontInputRef.current?.click() : backInputRef.current?.click())}>
                Replace
              </Button>
              {previewSide && (previewSide === 'front' ? frontDocumentId : backDocumentId) ? (
                <Button variant="light" color="red" leftSection={<Trash2 size={15} />} onClick={() => setRemoveSide(previewSide)}>
                  Remove
                </Button>
              ) : null}
            </Group>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={Boolean(removeSide)}
        onClose={() => setRemoveSide(null)}
        centered
        title={`Remove ${removeSide === 'front' ? 'front' : 'back'} document?`}
      >
        <Stack gap={spacing[3]}>
          <Text size="sm" c="#475569">
            This image will be removed from the current check-in record. You can upload or capture a new one afterward.
          </Text>
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setRemoveSide(null)}>
              Cancel
            </Button>
            <Button color="red" leftSection={<Trash2 size={15} />} loading={removeSide ? Boolean(documentActionLoading[removeSide]) : false} onClick={() => removeSide && void removeDocument(removeSide)}>
              Remove Document
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
