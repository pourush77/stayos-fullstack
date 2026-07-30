import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AmenityCategory } from '../domain/amenity-category.enum';

export class CreateAmenityDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsEnum(AmenityCategory)
  category!: AmenityCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAmenityDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsEnum(AmenityCategory)
  category?: AmenityCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AmenityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ enum: AmenityCategory })
  category!: AmenityCategory;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  createdAt?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  updatedAt?: Date;
}

export class SetRoomTypeAmenitiesDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  amenityIds!: string[];
}
