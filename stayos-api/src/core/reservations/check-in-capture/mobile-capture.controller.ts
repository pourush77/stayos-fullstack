import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { Permissions } from '../../auth/permissions';
import { MobileCaptureService } from './mobile-capture.service';

const multerOptions = {
  storage: undefined,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (
    _req: unknown,
    file: { mimetype: string },
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype));
  },
};

type UploadedDocumentFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Controller()
export class MobileCaptureController {
  constructor(private readonly mobileCaptureService: MobileCaptureService) {}

  @Post('properties/:propertyId/reservations/:reservationId/check-in/mobile-capture')
  @RequirePermissions(Permissions.CheckinManage, Permissions.GuestsManage)
  createReservationSession(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
  ) {
    return this.mobileCaptureService.createSession(propertyId, reservationId);
  }

  @Delete('properties/:propertyId/reservations/:reservationId/check-in/documents/:documentId')
  @RequirePermissions(Permissions.CheckinManage, Permissions.GuestsManage)
  deleteReceptionistDocument(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.mobileCaptureService.deleteDocument(propertyId, reservationId, documentId);
  }

  @Get('properties/:propertyId/reservations/:reservationId/check-in/documents/:documentId/preview')
  @RequirePermissions(Permissions.CheckinManage, Permissions.BookingsView)
  @RawResponse()
  @Header('Cache-Control', 'private, max-age=0, no-cache')
  async previewReceptionistDocument(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res() res: Response,
  ) {
    const doc = await this.mobileCaptureService.getDocumentPreview(propertyId, reservationId, documentId);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    res.send(doc.buffer);
  }

  @Get('properties/:propertyId/reservations/:reservationId/check-in/mobile-capture/status')
  @RequirePermissions(Permissions.CheckinManage, Permissions.BookingsView)
  getReservationSessionStatus(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
  ) {
    return this.mobileCaptureService.getReservationSessionStatus(propertyId, reservationId);
  }

  @Post('properties/:propertyId/reservations/:reservationId/check-in/documents')
  @RequirePermissions(Permissions.CheckinManage)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadReceptionistDocument(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body('type') type: 'front' | 'back' | 'guest_face',
    @UploadedFile() file: UploadedDocumentFile,
  ) {
    void propertyId;
    const side =
      type === 'back' ? 'ID_BACK' : type === 'guest_face' ? 'GUEST_FACE' : 'ID_FRONT';
    return this.mobileCaptureService
      .createSession(propertyId, reservationId)
      .then((session) =>
        this.mobileCaptureService.uploadBySessionId(session.sessionId, side, file),
      );
  }

  @Post('mobile-capture/session')
  @RequirePermissions(Permissions.CheckinManage)
  createSession(@Body() body: { propertyId: string; reservationId: string }) {
    return this.mobileCaptureService.createSession(body.propertyId, body.reservationId);
  }

  @Get('mobile-capture/session/:id/status')
  @RequirePermissions(Permissions.CheckinManage, Permissions.BookingsView)
  getSessionStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.mobileCaptureService.getSessionStatus(id);
  }

  @Post('mobile-capture/session/:id/documents')
  @RequirePermissions(Permissions.CheckinManage)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadSessionDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('type') type: 'ID_FRONT' | 'ID_BACK',
    @UploadedFile() file: UploadedDocumentFile,
  ) {
    return this.mobileCaptureService.uploadBySessionId(id, type, file);
  }
}
