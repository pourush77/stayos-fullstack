import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiMetaDto } from './api-meta.dto';
import { PaginationMetaDto } from './pagination.dto';

export class ApiSuccessResponseDto<TData = unknown> {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Operation completed successfully.' })
  message!: string;

  @ApiProperty()
  data!: TData;

  @ApiProperty({ type: ApiMetaDto })
  meta!: ApiMetaDto;
}

export class ApiListSuccessResponseDto<TData = unknown> extends ApiSuccessResponseDto<TData[]> {
  @ApiProperty({ example: 'Records fetched successfully.' })
  message!: string;

  @ApiProperty({ isArray: true })
  data!: TData[];

  @ApiPropertyOptional({ type: PaginationMetaDto })
  pagination?: PaginationMetaDto;
}

export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
  version: string;
}

export interface ApiSuccessResponse<TData = unknown> {
  success: true;
  message: string;
  data: TData;
  meta: ApiResponseMeta;
}

export interface ApiListSuccessResponse<TData = unknown> extends ApiSuccessResponse<TData[]> {
  pagination?: PaginationMetaDto;
}

export interface PreWrappedSuccessResponse<TData = unknown> extends Partial<
  ApiSuccessResponse<TData>
> {
  success: true;
  data: TData;
}
