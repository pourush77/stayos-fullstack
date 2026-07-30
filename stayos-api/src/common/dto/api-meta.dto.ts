import { ApiProperty } from '@nestjs/swagger';

export class ApiMetaDto {
  @ApiProperty({ example: '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670' })
  requestId!: string;

  @ApiProperty({ example: '2026-06-30T00:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 'v1' })
  version!: string;
}
