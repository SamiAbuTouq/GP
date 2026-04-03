import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

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
}
