import { IsString, IsInt, IsNotEmpty, Min, Max, IsOptional, IsArray, IsEmail } from 'class-validator';

export class CreateLecturerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  department: string;

  @IsInt()
  @Min(1)
  @Max(24)
  maxWorkload: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  courses?: string[];
}

export class UpdateLecturerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsInt()
  @Min(1)
  @Max(24)
  @IsOptional()
  maxWorkload?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  courses?: string[];
}
