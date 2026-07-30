import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../../auth/decorators/public.decorator';
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

@Public()
@Controller('check-in-capture/:token')
export class CheckInCaptureController {
  constructor(private readonly mobileCaptureService: MobileCaptureService) {}

  @Get()
  getSession(@Param('token') token: string) {
    return this.mobileCaptureService.getSessionByToken(token);
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadDocument(
    @Param('token') token: string,
    @Body('type') type: 'ID_FRONT' | 'ID_BACK',
    @UploadedFile() file: UploadedDocumentFile,
  ) {
    return this.mobileCaptureService.uploadByToken(token, type, file);
  }

  @Post('complete')
  complete(@Param('token') token: string) {
    return this.mobileCaptureService.completeByToken(token);
  }
}
