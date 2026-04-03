import { IsString, IsInt, IsNotEmpty, Min, IsOptional, IsBoolean } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}

export class UpdateRoomDto {
  @IsString()
  @IsOptional()
  type?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
