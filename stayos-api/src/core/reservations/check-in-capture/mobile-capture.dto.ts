export type MobileCaptureDto = {
  allowedDocumentTypes: string[];
  backUploaded: boolean;
  completedAt: string | null;
  expiresAt: string;
  frontUploaded: boolean;
  guestDisplayName: string;
  reservationReference: string;
  sessionId: string;
  status: string;
  token: string;
};
