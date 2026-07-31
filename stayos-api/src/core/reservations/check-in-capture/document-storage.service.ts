import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class DocumentStorageService {
  private readonly root = join(process.cwd(), '.storage', 'check-in-documents');

  async save(input: {
    buffer: Buffer;
    documentId: string;
    mimeType: string;
    propertyId: string;
    reservationId: string;
  }): Promise<string> {
    const ext = this.extensionFor(input.mimeType);
    const directory = join(this.root, input.propertyId, input.reservationId);
    await fs.mkdir(directory, { recursive: true });
    const path = join(directory, `${input.documentId}.${ext}`);
    await fs.writeFile(path, input.buffer);
    return path;
  }

  async read(storagePath: string): Promise<Buffer> {
    return fs.readFile(storagePath);
  }

  private extensionFor(mimeType: string): string {
    const map: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    return map[mimeType] ?? 'bin';
  }
}
