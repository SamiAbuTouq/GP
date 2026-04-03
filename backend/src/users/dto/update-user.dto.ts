import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  avatar_base64?: string;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  @IsIn(['system', 'light', 'dark'])
  theme_preference?: string;

  @IsOptional()
  @IsString()
  @IsIn(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])
  date_format?: string;

  @IsOptional()
  @IsString()
  @IsIn(['12', '24'])
  time_format?: string;
}
