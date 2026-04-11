import { IsString, IsInt, IsNotEmpty, Min, Max, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { DeliveryMode } from '@prisma/client';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(1)
  @Max(6)
  creditHours: number;

  @IsInt()
  @Min(1)
  @Max(9)
  academicLevel: number;

  @IsEnum(DeliveryMode)
  @IsNotEmpty()
  deliveryMode: DeliveryMode;

  @IsString()
  @IsNotEmpty()
  department: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  sections?: number;

  @IsOptional()
  @IsBoolean()
  isLab?: boolean;
}

export class UpdateCourseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @Min(1)
  @Max(6)
  @IsOptional()
  creditHours?: number;

  @IsInt()
  @Min(1)
  @Max(9)
  @IsOptional()
  academicLevel?: number;

  @IsOptional()
  @IsEnum(DeliveryMode)
  deliveryMode?: DeliveryMode;

  @IsString()
  @IsOptional()
  department?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  sections?: number;

  @IsOptional()
  @IsBoolean()
  isLab?: boolean;
}
