import { IsString, IsInt, IsNotEmpty, Min, Max, IsOptional } from 'class-validator';

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
  @Max(5)
  academicLevel: number;

  @IsString()
  @IsNotEmpty()
  deliveryMode: string;

  @IsString()
  @IsNotEmpty()
  department: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  sections?: number;
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
  @Max(5)
  @IsOptional()
  academicLevel?: number;

  @IsString()
  @IsOptional()
  deliveryMode?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  sections?: number;
}
