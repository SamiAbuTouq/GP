import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ValidateNested,
  IsInt,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTimeslotDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  days: string[];

  @IsString()
  @IsNotEmpty()
  start: string;

  @IsString()
  @IsNotEmpty()
  end: string;

  @IsString()
  @IsNotEmpty()
  slotType: string;

  @IsBoolean()
  isSummer: boolean;
}

export class UpdateTimeslotDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  days?: string[];

  @IsString()
  @IsOptional()
  start?: string;

  @IsString()
  @IsOptional()
  end?: string;

  @IsString()
  @IsOptional()
  slotType?: string;

  @IsBoolean()
  @IsOptional()
  isSummer?: boolean;
}

export class UpdateLecturerPreferenceItemDto {
  @IsInt()
  slotId: number;

  @IsBoolean()
  isPreferred: boolean;
}

export class UpdateLecturerPreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateLecturerPreferenceItemDto)
  preferences: UpdateLecturerPreferenceItemDto[];
}
