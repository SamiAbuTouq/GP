import {
  IsString,
  IsInt,
  IsNotEmpty,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsEmail,
  IsBoolean,
} from "class-validator";

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
  @Max(30)
  maxWorkload: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  courses?: string[];

  /**
   * When false, creates a lecturer usable in scheduling but does not send the welcome email
   * and portal sign-in is disabled for that account until changed in the database.
   */
  @IsOptional()
  @IsBoolean()
  createPortalUser?: boolean;
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
  @Max(30)
  @IsOptional()
  maxWorkload?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  courses?: string[];
}
