import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum GlobalSearchResultType {
  GUEST = 'guest',
  RESERVATION = 'reservation',
  STAY = 'stay',
  ROOM = 'room',
  FOLIO = 'folio',
}

export class GlobalSearchResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: GlobalSearchResultType })
  type!: GlobalSearchResultType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  subtitle!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  badge?: string;

  @ApiProperty({
    example: '/reservations/7287b571-55ce-4de2-b356-e65a979be812',
  })
  route!: string;

  @ApiProperty({
    description: 'Internal relevance score. Higher-value results are more important.',
  })
  priority!: number;
}

export class GlobalSearchGroupsDto {
  @ApiProperty({ type: [GlobalSearchResultDto] })
  stays!: GlobalSearchResultDto[];

  @ApiProperty({ type: [GlobalSearchResultDto] })
  reservations!: GlobalSearchResultDto[];

  @ApiProperty({ type: [GlobalSearchResultDto] })
  guests!: GlobalSearchResultDto[];

  @ApiProperty({ type: [GlobalSearchResultDto] })
  rooms!: GlobalSearchResultDto[];

  @ApiProperty({ type: [GlobalSearchResultDto] })
  folios!: GlobalSearchResultDto[];
}

export class GlobalSearchResponseDto {
  @ApiProperty()
  query!: string;

  @ApiProperty()
  total!: number;

  @ApiProperty({ type: GlobalSearchGroupsDto })
  results!: GlobalSearchGroupsDto;
}
