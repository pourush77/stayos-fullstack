import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { UpsertPropertyTaxConfigInput } from './upsert-property-tax-config.input';

export class UpsertPropertyTaxConfigDto implements UpsertPropertyTaxConfigInput {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ example: 'GST' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: '12.00' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{1,3}(\.\d{1,2})?$/)
  percentage!: string;
}
