import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  FileButton,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { radius, spacing } from '@stayos/theme';
import { showToast } from '@stayos/ui';
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Circle,
  CreditCard,
  DoorOpen,
  FileCheck2,
  Hotel,
  IdCard,
  Upload,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import type { Reservation } from '../../../lib/reservation-hooks';
import {
  markPaymentReviewed,
  saveGuestRegistration,
  saveIdentity,
  uploadIdentityDocument,
} from '../../check-in/check-in-api';
import styles from '../RoomsPage.module.css';
import type { Room } from '../types';
import { DetailTile } from './DetailTile';

type StepKey = 'booking' | 'registration' | 'identity' | 'payment' | 'room' | 'review';
type StepStatus = 'complete' | 'warning' | 'blocked';

type RegistrationForm = {
  address1: string;
  address2: string;
  arrivalFrom: string;
  city: string;
  country: string;
  dateOfBirth: string;
  email: string;
  fullName: string;
  gender: string;
  mobile: string;
  nationality: string;
  nextDestination: string;
  passportExpiryDate: string;
  passportIssueDate: string;
  passportIssuePlace: string;
  passportNumber: string;
  pinCode: string;
  purposeOfVisit: string;
  state: string;
  visaExpiryDate: string;
  visaIssueDate: string;
  visaNumber: string;
  visaType: string;
};

type IdentityForm = {
  idNumber: string;
  idType: string;
  verified: boolean;
};

const steps: Array<{ key: StepKey; label: string; title: string }> = [
  { key: 'booking', label: 'Booking', title: 'Booking Review' },
  { key: 'registration', label: 'Registration', title: 'Guest Registration' },
  { key: 'identity', label: 'Identity', title: 'Identity Verification' },
  { key: 'payment', label: 'Payment', title: 'Payment Review' },
  { key: 'room', label: 'Room', title: 'Room Readiness' },
  { key: 'review', label: 'Review', title: 'Final Review' },
];

const requiredRegistrationFields: Array<keyof RegistrationForm> = [
  'fullName',
  'mobile',
  'address1',
  'city',
  'state',
  'country',
  'pinCode',
  'purposeOfVisit',
];

const identityTypeByLabel: Record<string, string> = {
  Aadhaar: 'AADHAAR',
  'Driving Licence': 'DRIVING_LICENSE',
  Other: 'OTHER',
  PAN: 'PAN',
  Passport: 'PASSPORT',
  'Voter ID': 'VOTER_ID',
};

function guestBreakdown(occupancy: string) {
  const adults = occupancy.match(/(\d+)\s+Adult/i)?.[1] ?? 'Not recorded';
  const children = occupancy.match(/(\d+)\s+Child/i)?.[1] ?? '0';

  return { adults, children };
}

function isPaymentDue(payment?: string) {
  const normalized = (payment ?? '').toLowerCase();

  return (
    normalized.includes('due') || normalized.includes('partial') || normalized.includes('pending')
  );
}

function isIndia(value: string) {
  return ['india', 'in', 'indian'].includes(value.trim().toLowerCase());
}

function readinessFor(room: Room | null) {
  const status = room?.status;
  const operationalStatus = status ?? 'Not recorded';
  const roomAssigned = Boolean(room?.reservationId);
  const roomReady = status === 'ready' || status === 'reserved';
  const housekeepingClear = !['dirty', 'cleaning', 'inspection'].includes(status ?? '');
  const maintenanceClear = !['maintenance', 'out-of-order', 'out-of-service'].includes(
    status ?? '',
  );
  const notOccupied = status !== 'occupied';

  return {
    housekeepingClear,
    maintenanceClear,
    notOccupied,
    operationalStatus,
    roomAssigned,
    roomReady,
  };
}

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === 'complete') {
    return (
      <Badge color="green" variant="light" leftSection={<CheckCircle2 size={12} />}>
        complete
      </Badge>
    );
  }

  if (status === 'blocked') {
    return (
      <Badge color="red" variant="light" leftSection={<XCircle size={12} />}>
        blocked
      </Badge>
    );
  }

  return (
    <Badge color="yellow" variant="light" leftSection={<AlertTriangle size={12} />}>
      warning
    </Badge>
  );
}

function SectionHeader({
  detail,
  icon,
  title,
}: {
  detail: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Group gap={10} align="flex-start" wrap="nowrap">
      <ThemeIcon color="stayosBrand" variant="light" radius={radius.full} size={34}>
        {icon}
      </ThemeIcon>
      <Box>
        <Text c="#101828" style={{ fontSize: 15, fontWeight: 700, lineHeight: '21px' }}>
          {title}
        </Text>
        <Text c="#64748b" mt={2} style={{ fontSize: 12, fontWeight: 450, lineHeight: '17px' }}>
          {detail}
        </Text>
      </Box>
    </Group>
  );
}

function CheckItem({
  complete,
  label,
  blocked,
}: {
  blocked?: boolean;
  complete: boolean;
  label: string;
}) {
  const color = complete ? '#16a34a' : blocked ? '#dc2626' : '#d97706';
  const Icon = complete ? CheckCircle2 : blocked ? XCircle : AlertTriangle;

  return (
    <Group gap={8} wrap="nowrap">
      <Icon size={16} color={color} />
      <Text c={complete ? '#334155' : blocked ? '#991b1b' : '#92400e'} size="sm" fw={550}>
        {label}
      </Text>
    </Group>
  );
}

export function CheckInModal({
  loading,
  onClose,
  onConfirm,
  opened,
  propertyId,
  reservation,
  room,
}: {
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  opened: boolean;
  propertyId?: string;
  reservation?: Reservation;
  room: Room | null;
}) {
  const guests = guestBreakdown(reservation?.occupancy ?? '');
  const paymentStatus = reservation?.payment ?? room?.paymentStatus ?? 'Not recorded';
  const paymentDue = isPaymentDue(paymentStatus);
  const readiness = readinessFor(room);
  const [activeStep, setActiveStep] = useState<StepKey>('booking');
  const [registrationSaved, setRegistrationSaved] = useState(false);
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentReviewed, setPaymentReviewed] = useState(!paymentDue);
  const [uploadingSide, setUploadingSide] = useState<'front' | 'back' | null>(null);
  const [identity, setIdentity] = useState<IdentityForm>({
    idNumber: '',
    idType: 'Aadhaar',
    verified: false,
  });
  const [registration, setRegistration] = useState<RegistrationForm>({
    address1: '',
    address2: '',
    arrivalFrom: '',
    city: '',
    country: 'India',
    dateOfBirth: '',
    email: reservation?.email ?? '',
    fullName: reservation?.guest ?? room?.guest ?? '',
    gender: '',
    mobile: reservation?.phone ?? '',
    nationality: 'India',
    nextDestination: '',
    passportExpiryDate: '',
    passportIssueDate: '',
    passportIssuePlace: '',
    passportNumber: '',
    pinCode: '',
    purposeOfVisit: '',
    state: '',
    visaExpiryDate: '',
    visaIssueDate: '',
    visaNumber: '',
    visaType: '',
  });

  const isForeignGuest = !isIndia(registration.nationality);
  const registrationComplete =
    requiredRegistrationFields.every((field) => registration[field].trim().length > 0) &&
    (!isForeignGuest ||
      Boolean(
        registration.passportNumber &&
        registration.passportIssuePlace &&
        registration.passportIssueDate &&
        registration.passportExpiryDate &&
        registration.visaNumber &&
        registration.visaType &&
        registration.visaIssueDate &&
        registration.visaExpiryDate,
      ));
  const identityComplete = identity.verified && identity.idType.trim() && identity.idNumber.trim();
  const roomReady =
    readiness.roomAssigned &&
    readiness.roomReady &&
    readiness.housekeepingClear &&
    readiness.maintenanceClear &&
    readiness.notOccupied;

  const blockers = useMemo(() => {
    const items: string[] = [];
    if (!registrationComplete) items.push('Guest registration incomplete.');
    if (!identityComplete) items.push('ID verification is required.');
    if (!paymentReviewed) items.push('Payment review is required.');
    if (!roomReady) items.push('Room is not ready.');
    if (room?.status === 'occupied' || reservation?.status === 'Checked-in') {
      items.push('Check-in already completed.');
    }
    return items;
  }, [
    identityComplete,
    paymentReviewed,
    registrationComplete,
    reservation?.status,
    room?.status,
    roomReady,
  ]);

  const stepStatuses: Record<StepKey, StepStatus> = {
    booking: readiness.roomAssigned ? 'complete' : 'blocked',
    registration: registrationComplete && registrationSaved ? 'complete' : 'warning',
    identity: identityComplete ? 'complete' : 'blocked',
    payment: paymentReviewed ? 'complete' : 'warning',
    room: roomReady ? 'complete' : 'blocked',
    review: blockers.length === 0 ? 'complete' : 'blocked',
  };

  const canCheckIn = blockers.length === 0 && registrationSaved;
  const activeIndex = steps.findIndex((step) => step.key === activeStep);
  const activeTitle = steps[activeIndex]?.title ?? 'Check In';

  const updateRegistration = (field: keyof RegistrationForm, value: string) => {
    setRegistration((current) => ({ ...current, [field]: value }));
    setRegistrationSaved(false);
  };

  const continueTo = (step: StepKey) => setActiveStep(step);
  const nextStep = () => setActiveStep(steps[Math.min(activeIndex + 1, steps.length - 1)].key);
  const handleIdentityUpload = async (side: 'front' | 'back', file: File | null) => {
    if (!file || !propertyId || !reservation?.backendId) return;
    setUploadingSide(side);
    try {
      await uploadIdentityDocument(propertyId, reservation.backendId, side, file);
    } finally {
      setUploadingSide(null);
    }
  };

  const handleSaveRegistration = async () => {
    if (!propertyId || !reservation?.backendId || !registrationComplete) return;

    setSavingRegistration(true);
    try {
      await saveGuestRegistration(propertyId, reservation.backendId, {
        addressLine1: registration.address1,
        addressLine2: registration.address2 || undefined,
        arrivalFrom: registration.arrivalFrom || undefined,
        cFormRequired: isForeignGuest,
        city: registration.city,
        country: registration.country,
        dateOfBirth: registration.dateOfBirth || undefined,
        email: registration.email || undefined,
        fullName: registration.fullName,
        gender: registration.gender || undefined,
        isForeignNational: isForeignGuest,
        mobile: registration.mobile,
        nationality: registration.nationality,
        nextDestination: registration.nextDestination || undefined,
        passportExpiryDate: registration.passportExpiryDate || undefined,
        passportIssueDate: registration.passportIssueDate || undefined,
        passportIssuePlace: registration.passportIssuePlace || undefined,
        passportNumber: registration.passportNumber || undefined,
        postalCode: registration.pinCode,
        purposeOfVisit: registration.purposeOfVisit,
        state: registration.state,
        visaExpiryDate: registration.visaExpiryDate || undefined,
        visaIssueDate: registration.visaIssueDate || undefined,
        visaNumber: registration.visaNumber || undefined,
        visaType: registration.visaType || undefined,
      });
      setRegistrationSaved(true);
      showToast({
        color: 'green',
        message: 'Guest registration saved.',
        title: 'Registration updated',
      });
    } catch (error) {
      showToast({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to save guest registration.',
        title: 'Registration failed',
      });
    } finally {
      setSavingRegistration(false);
    }
  };

  const handleSaveIdentityAndContinue = async () => {
    if (!propertyId || !reservation?.backendId || !identityComplete) return;

    setSavingIdentity(true);
    try {
      await saveIdentity(propertyId, reservation.backendId, {
        idNumber: identity.idNumber,
        idType: identityTypeByLabel[identity.idType] ?? 'OTHER',
        verified: identity.verified,
      });
      nextStep();
    } catch (error) {
      showToast({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to save identity verification.',
        title: 'Identity save failed',
      });
    } finally {
      setSavingIdentity(false);
    }
  };

  const handleSavePaymentAndContinue = async () => {
    if (!propertyId || !reservation?.backendId || !paymentReviewed) return;

    setSavingPayment(true);
    try {
      await markPaymentReviewed(propertyId, reservation.backendId);
      nextStep();
    } catch (error) {
      showToast({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to save payment review.',
        title: 'Payment save failed',
      });
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      withCloseButton={false}
      padding={0}
      styles={{ body: { background: '#f8fafc', minHeight: '100vh' } }}
    >
      <Stack gap={0} mih="100vh">
        <Box
          bg="white"
          px={{ base: 16, md: 28 }}
          py={16}
          style={{ borderBottom: '1px solid #e5e7eb' }}
        >
          <Group justify="space-between" align="flex-start" gap={spacing[3]}>
            <Box>
              <Group gap={10} wrap="wrap">
                <Title order={1} c="#101828" style={{ fontSize: 24, lineHeight: '30px' }}>
                  Check In
                </Title>
                <Badge color="stayosBrand" variant="light">
                  {reservation?.id ?? room?.reservation ?? 'No reservation code'}
                </Badge>
              </Group>
              <Text c="#475569" mt={4} size="sm" fw={550}>
                {reservation?.guest ?? room?.guest ?? 'Guest'} · Room {room?.number ?? 'Unassigned'}
              </Text>
            </Box>
            <Button variant="subtle" color="gray" leftSection={<X size={16} />} onClick={onClose}>
              Close
            </Button>
          </Group>

          <Group mt={16} gap={8} wrap="wrap">
            {steps.map((step) => (
              <Button
                key={step.key}
                variant={activeStep === step.key ? 'filled' : 'light'}
                color={activeStep === step.key ? 'stayosBrand' : 'gray'}
                size="xs"
                radius={radius.full}
                rightSection={<StatusBadge status={stepStatuses[step.key]} />}
                onClick={() => continueTo(step.key)}
                styles={{ label: { gap: 8 } }}
              >
                {step.label}
              </Button>
            ))}
          </Group>
        </Box>

        <Box px={{ base: 16, md: 28 }} py={20} style={{ flex: 1 }}>
          <SimpleGrid cols={{ base: 1, lg: 12 }} spacing={spacing[4]}>
            <Box style={{ gridColumn: 'span 8' }}>
              <Paper radius={radius.lg} p={{ base: 16, md: 20 }} className={styles.surfaceCard}>
                <Stack gap={spacing[4]}>
                  <Group justify="space-between" align="flex-start">
                    <SectionHeader
                      icon={
                        activeStep === 'booking' ? (
                          <FileCheck2 size={17} />
                        ) : activeStep === 'registration' ? (
                          <UserRound size={17} />
                        ) : activeStep === 'identity' ? (
                          <IdCard size={17} />
                        ) : activeStep === 'payment' ? (
                          <CreditCard size={17} />
                        ) : activeStep === 'room' ? (
                          <Hotel size={17} />
                        ) : (
                          <CheckCircle2 size={17} />
                        )
                      }
                      title={activeTitle}
                      detail="Complete each desk check before marking the guest in-house."
                    />
                    <StatusBadge status={stepStatuses[activeStep]} />
                  </Group>

                  {activeStep === 'booking' ? (
                    <Stack gap={spacing[3]}>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                        <DetailTile
                          label="Guest name"
                          value={reservation?.guest ?? room?.guest ?? 'Guest'}
                        />
                        <DetailTile
                          label="Reservation code"
                          value={reservation?.id ?? room?.reservation ?? 'Not recorded'}
                        />
                        <DetailTile
                          label="Arrival date"
                          value={
                            reservation?.arrivalDate ??
                            room?.reservationArrivalDate ??
                            'Not recorded'
                          }
                        />
                        <DetailTile
                          label="Departure date"
                          value={
                            reservation?.departureDate ??
                            room?.reservationDepartureDate ??
                            'Not recorded'
                          }
                        />
                        <DetailTile label="Adults" value={guests.adults} />
                        <DetailTile label="Children" value={guests.children} />
                        <DetailTile label="Room number" value={room?.number ?? 'Unassigned'} />
                        <DetailTile
                          label="Room type"
                          value={room?.roomType ?? reservation?.roomType ?? 'Not recorded'}
                        />
                      </SimpleGrid>
                      <DetailTile
                        label="Special requests"
                        value={
                          reservation?.requests?.length
                            ? reservation.requests.join(', ')
                            : 'No special requests'
                        }
                      />
                      <Group justify="flex-end">
                        <Button color="stayosBrand" onClick={nextStep}>
                          Continue
                        </Button>
                      </Group>
                    </Stack>
                  ) : null}

                  {activeStep === 'registration' ? (
                    <Stack gap={spacing[4]}>
                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing={spacing[3]}>
                        <TextInput
                          label="Full name"
                          required
                          value={registration.fullName}
                          onChange={(event) =>
                            updateRegistration('fullName', event.currentTarget.value)
                          }
                        />
                        <TextInput
                          label="Mobile"
                          required
                          value={registration.mobile}
                          onChange={(event) =>
                            updateRegistration('mobile', event.currentTarget.value)
                          }
                        />
                        <TextInput
                          label="Email"
                          value={registration.email}
                          onChange={(event) =>
                            updateRegistration('email', event.currentTarget.value)
                          }
                        />
                        <TextInput
                          label="Date of birth"
                          type="date"
                          value={registration.dateOfBirth}
                          onChange={(event) =>
                            updateRegistration('dateOfBirth', event.currentTarget.value)
                          }
                        />
                        <Select
                          label="Gender"
                          data={['Female', 'Male', 'Non-binary', 'Prefer not to say']}
                          value={registration.gender || null}
                          onChange={(value) => updateRegistration('gender', value ?? '')}
                        />
                        <TextInput
                          label="Nationality"
                          value={registration.nationality}
                          onChange={(event) =>
                            updateRegistration('nationality', event.currentTarget.value)
                          }
                        />
                      </SimpleGrid>

                      <Divider label="Address" labelPosition="left" />
                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing={spacing[3]}>
                        <TextInput
                          label="Address line 1"
                          required
                          value={registration.address1}
                          onChange={(event) =>
                            updateRegistration('address1', event.currentTarget.value)
                          }
                        />
                        <TextInput
                          label="Address line 2"
                          value={registration.address2}
                          onChange={(event) =>
                            updateRegistration('address2', event.currentTarget.value)
                          }
                        />
                        <TextInput
                          label="City"
                          required
                          value={registration.city}
                          onChange={(event) =>
                            updateRegistration('city', event.currentTarget.value)
                          }
                        />
                        <TextInput
                          label="State"
                          required
                          value={registration.state}
                          onChange={(event) =>
                            updateRegistration('state', event.currentTarget.value)
                          }
                        />
                        <TextInput
                          label="Country"
                          required
                          value={registration.country}
                          onChange={(event) =>
                            updateRegistration('country', event.currentTarget.value)
                          }
                        />
                        <TextInput
                          label="PIN / postal code"
                          required
                          value={registration.pinCode}
                          onChange={(event) =>
                            updateRegistration('pinCode', event.currentTarget.value)
                          }
                        />
                      </SimpleGrid>

                      <Divider label="Travel details" labelPosition="left" />
                      <SimpleGrid cols={{ base: 1, md: 3 }} spacing={spacing[3]}>
                        <TextInput
                          label="Purpose of visit"
                          required
                          value={registration.purposeOfVisit}
                          onChange={(event) =>
                            updateRegistration('purposeOfVisit', event.currentTarget.value)
                          }
                        />
                        <TextInput
                          label="Arrival from"
                          value={registration.arrivalFrom}
                          onChange={(event) =>
                            updateRegistration('arrivalFrom', event.currentTarget.value)
                          }
                        />
                        <TextInput
                          label="Next destination"
                          value={registration.nextDestination}
                          onChange={(event) =>
                            updateRegistration('nextDestination', event.currentTarget.value)
                          }
                        />
                      </SimpleGrid>

                      {isForeignGuest ? (
                        <Paper
                          radius={radius.md}
                          p={14}
                          bg="#fffbeb"
                          style={{ border: '1px solid #fde68a' }}
                        >
                          <Stack gap={spacing[3]}>
                            <Group justify="space-between">
                              <Text fw={700} c="#92400e">
                                Foreign guest details
                              </Text>
                              <Badge color="yellow" variant="filled">
                                C-Form required
                              </Badge>
                            </Group>
                            <SimpleGrid cols={{ base: 1, md: 2 }} spacing={spacing[3]}>
                              <TextInput
                                label="Passport number"
                                required
                                value={registration.passportNumber}
                                onChange={(event) =>
                                  updateRegistration('passportNumber', event.currentTarget.value)
                                }
                              />
                              <TextInput
                                label="Passport issue place"
                                required
                                value={registration.passportIssuePlace}
                                onChange={(event) =>
                                  updateRegistration(
                                    'passportIssuePlace',
                                    event.currentTarget.value,
                                  )
                                }
                              />
                              <TextInput
                                label="Passport issue date"
                                type="date"
                                required
                                value={registration.passportIssueDate}
                                onChange={(event) =>
                                  updateRegistration('passportIssueDate', event.currentTarget.value)
                                }
                              />
                              <TextInput
                                label="Passport expiry date"
                                type="date"
                                required
                                value={registration.passportExpiryDate}
                                onChange={(event) =>
                                  updateRegistration(
                                    'passportExpiryDate',
                                    event.currentTarget.value,
                                  )
                                }
                              />
                              <TextInput
                                label="Visa number"
                                required
                                value={registration.visaNumber}
                                onChange={(event) =>
                                  updateRegistration('visaNumber', event.currentTarget.value)
                                }
                              />
                              <TextInput
                                label="Visa type"
                                required
                                value={registration.visaType}
                                onChange={(event) =>
                                  updateRegistration('visaType', event.currentTarget.value)
                                }
                              />
                              <TextInput
                                label="Visa issue date"
                                type="date"
                                required
                                value={registration.visaIssueDate}
                                onChange={(event) =>
                                  updateRegistration('visaIssueDate', event.currentTarget.value)
                                }
                              />
                              <TextInput
                                label="Visa expiry date"
                                type="date"
                                required
                                value={registration.visaExpiryDate}
                                onChange={(event) =>
                                  updateRegistration('visaExpiryDate', event.currentTarget.value)
                                }
                              />
                            </SimpleGrid>
                          </Stack>
                        </Paper>
                      ) : null}

                      {!registrationComplete ? (
                        <Alert color="yellow">Guest registration incomplete.</Alert>
                      ) : null}
                      <Group justify="flex-end">
                        <Button
                          variant="light"
                          color="gray"
                          onClick={() => void handleSaveRegistration()}
                          disabled={!registrationComplete || savingRegistration}
                          loading={savingRegistration}
                        >
                          Save registration
                        </Button>
                        <Button
                          color="stayosBrand"
                          onClick={nextStep}
                          disabled={!registrationComplete || !registrationSaved}
                        >
                          Continue
                        </Button>
                      </Group>
                    </Stack>
                  ) : null}

                  {activeStep === 'identity' ? (
                    <Stack gap={spacing[4]}>
                      <SimpleGrid cols={{ base: 1, md: 2 }} spacing={spacing[3]}>
                        <Select
                          label="ID type"
                          data={[
                            'Aadhaar',
                            'Passport',
                            'Driving Licence',
                            'Voter ID',
                            'PAN',
                            'Other',
                          ]}
                          value={identity.idType}
                          onChange={(value) =>
                            setIdentity((current) => ({
                              ...current,
                              idType: value ?? 'Aadhaar',
                              verified: false,
                            }))
                          }
                        />
                        <TextInput
                          label="ID number"
                          value={identity.idNumber}
                          onChange={(event) => {
                            const idNumber = event.currentTarget.value;
                            setIdentity((current) => ({ ...current, idNumber, verified: false }));
                          }}
                        />
                      </SimpleGrid>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                        <FileButton
                          onChange={(file) => void handleIdentityUpload('front', file)}
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                        >
                          {(props) => (
                            <Button
                              {...props}
                              variant="light"
                              color="gray"
                              leftSection={<Upload size={15} />}
                              disabled={
                                !propertyId || !reservation?.backendId || uploadingSide !== null
                              }
                              loading={uploadingSide === 'front'}
                            >
                              Upload front
                            </Button>
                          )}
                        </FileButton>
                        <FileButton
                          onChange={(file) => void handleIdentityUpload('back', file)}
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                        >
                          {(props) => (
                            <Button
                              {...props}
                              variant="light"
                              color="gray"
                              leftSection={<Upload size={15} />}
                              disabled={
                                !propertyId || !reservation?.backendId || uploadingSide !== null
                              }
                              loading={uploadingSide === 'back'}
                            >
                              Upload back
                            </Button>
                          )}
                        </FileButton>
                      </SimpleGrid>
                      <Alert color="blue" variant="light">
                        Manual verification by receptionist.
                      </Alert>
                      <Checkbox
                        label="Mark ID verified"
                        checked={identity.verified}
                        disabled={!identity.idNumber.trim()}
                        onChange={(event) => {
                          const verified = event.currentTarget.checked;
                          setIdentity((current) => ({ ...current, verified }));
                        }}
                      />
                      {identityComplete ? (
                        <Alert color="green" variant="light">
                          ID verified.
                        </Alert>
                      ) : (
                        <Alert color="yellow" variant="light">
                          ID verification is required before check-in.
                        </Alert>
                      )}
                      <Group justify="flex-end">
                        <Button
                          color="stayosBrand"
                          onClick={() => void handleSaveIdentityAndContinue()}
                          disabled={!identityComplete || savingIdentity}
                          loading={savingIdentity}
                        >
                          Continue
                        </Button>
                      </Group>
                    </Stack>
                  ) : null}

                  {activeStep === 'payment' ? (
                    <Stack gap={spacing[3]}>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                        <DetailTile label="Payment status" value={paymentStatus} />
                        <DetailTile
                          label="Outstanding amount"
                          value={paymentDue ? (reservation?.amount ?? 'Pending') : '0'}
                        />
                        <DetailTile label="Payment method" value="Not recorded" />
                        <DetailTile label="Deposit status" value="Not available" />
                      </SimpleGrid>
                      {paymentDue ? (
                        <Alert color="yellow" variant="light">
                          Payment pending. Collection will be handled in billing.
                        </Alert>
                      ) : (
                        <Alert color="green" variant="light">
                          Payment complete.
                        </Alert>
                      )}
                      <Group justify="space-between">
                        <Button
                          variant="light"
                          color="gray"
                          leftSection={<CreditCard size={15} />}
                          disabled
                        >
                          Collect Payment
                        </Button>
                        <Group>
                          <Checkbox
                            label="Mark payment reviewed"
                            checked={paymentReviewed}
                            onChange={(event) => setPaymentReviewed(event.currentTarget.checked)}
                          />
                          <Button
                            color="stayosBrand"
                            onClick={() => void handleSavePaymentAndContinue()}
                            disabled={!paymentReviewed || savingPayment}
                            loading={savingPayment}
                          >
                            Continue
                          </Button>
                        </Group>
                      </Group>
                    </Stack>
                  ) : null}

                  {activeStep === 'room' ? (
                    <Stack gap={spacing[3]}>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[3]}>
                        <DetailTile
                          label="Current room"
                          value={room ? `Room ${room.number}` : 'Unassigned'}
                        />
                        <DetailTile
                          label="Room type"
                          value={room?.roomType ?? reservation?.roomType ?? 'Not recorded'}
                        />
                        <DetailTile label="Floor" value={room?.floor ?? 'Not recorded'} />
                        <DetailTile
                          label="Room operational status"
                          value={readiness.operationalStatus}
                        />
                        <DetailTile label="Capacity" value={room?.capacity ?? 'Not recorded'} />
                        <DetailTile label="Bed type" value={room?.bedType ?? 'Not recorded'} />
                      </SimpleGrid>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
                        <CheckItem
                          label="Room assigned"
                          complete={readiness.roomAssigned}
                          blocked={!readiness.roomAssigned}
                        />
                        <CheckItem
                          label="Room ready"
                          complete={readiness.roomReady}
                          blocked={!readiness.roomReady}
                        />
                        <CheckItem
                          label="Housekeeping clear"
                          complete={readiness.housekeepingClear}
                          blocked={!readiness.housekeepingClear}
                        />
                        <CheckItem
                          label="Maintenance clear"
                          complete={readiness.maintenanceClear}
                          blocked={!readiness.maintenanceClear}
                        />
                        <CheckItem
                          label="Not occupied"
                          complete={readiness.notOccupied}
                          blocked={!readiness.notOccupied}
                        />
                      </SimpleGrid>
                      {!roomReady ? (
                        <Alert color="red" variant="light">
                          Room {room?.number ?? ''} is not ready for check-in.
                        </Alert>
                      ) : null}
                      <Alert color="blue" variant="light">
                        Room can still be changed before completing check-in.
                      </Alert>
                      <Group justify="flex-end">
                        <Button color="stayosBrand" onClick={nextStep} disabled={!roomReady}>
                          Continue
                        </Button>
                      </Group>
                    </Stack>
                  ) : null}

                  {activeStep === 'review' ? (
                    <Stack gap={spacing[4]}>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={spacing[2]}>
                        <CheckItem
                          label="Booking reviewed"
                          complete={stepStatuses.booking === 'complete'}
                          blocked={stepStatuses.booking === 'blocked'}
                        />
                        <CheckItem
                          label="Guest registration complete"
                          complete={registrationComplete && registrationSaved}
                          blocked={false}
                        />
                        <CheckItem
                          label="Identity verified"
                          complete={Boolean(identityComplete)}
                          blocked={!identityComplete}
                        />
                        <CheckItem
                          label="Payment reviewed"
                          complete={paymentReviewed}
                          blocked={false}
                        />
                        <CheckItem label="Room ready" complete={roomReady} blocked={!roomReady} />
                      </SimpleGrid>
                      {blockers.length > 0 ? (
                        <Alert color="red" variant="light" title="Check-in blockers">
                          <Stack gap={4}>
                            {blockers.map((blocker) => (
                              <Text key={blocker} size="sm">
                                {blocker}
                              </Text>
                            ))}
                          </Stack>
                        </Alert>
                      ) : (
                        <Alert color="green" variant="light">
                          All checks are complete.
                        </Alert>
                      )}
                      <Group justify="flex-end">
                        <Button
                          color="stayosBrand"
                          disabled={!canCheckIn}
                          loading={loading}
                          leftSection={<DoorOpen size={16} />}
                          onClick={onConfirm}
                          className={styles.primaryButtonText}
                        >
                          Complete Check-in
                        </Button>
                      </Group>
                    </Stack>
                  ) : null}
                </Stack>
              </Paper>
            </Box>

            <Box style={{ gridColumn: 'span 4' }}>
              <Stack gap={spacing[3]}>
                <Paper radius={radius.lg} p={16} className={styles.surfaceCard}>
                  <Stack gap={spacing[3]}>
                    <Group gap={10}>
                      <ThemeIcon color="stayosBrand" variant="light" radius={radius.full}>
                        <BedDouble size={17} />
                      </ThemeIcon>
                      <Box>
                        <Text fw={700} c="#101828">
                          Desk summary
                        </Text>
                        <Text c="#64748b" size="xs">
                          Fast scan for the receptionist.
                        </Text>
                      </Box>
                    </Group>
                    <DetailTile
                      label="Guest"
                      value={registration.fullName || reservation?.guest || 'Guest'}
                    />
                    <DetailTile
                      label="Reservation"
                      value={reservation?.id ?? room?.reservation ?? 'Not recorded'}
                    />
                    <DetailTile label="Room" value={room ? `Room ${room.number}` : 'Unassigned'} />
                    <DetailTile
                      label="Payment"
                      value={paymentDue ? 'Payment pending' : 'Payment complete'}
                    />
                  </Stack>
                </Paper>

                <Paper radius={radius.lg} p={16} className={styles.surfaceCard}>
                  <Stack gap={spacing[2]}>
                    {steps.map((step) => (
                      <Group key={step.key} justify="space-between" wrap="nowrap">
                        <Group gap={8} wrap="nowrap">
                          {activeStep === step.key ? (
                            <Circle size={10} fill="#2563eb" color="#2563eb" />
                          ) : (
                            <Circle size={10} color="#cbd5e1" />
                          )}
                          <Text size="sm" fw={600} c="#334155">
                            {step.title}
                          </Text>
                        </Group>
                        <StatusBadge status={stepStatuses[step.key]} />
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              </Stack>
            </Box>
          </SimpleGrid>
        </Box>
      </Stack>
    </Modal>
  );
}
