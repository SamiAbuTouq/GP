import { IsObject } from 'class-validator';

export class UpdateNotificationPrefsDto {
  @IsObject()
  prefs!: Record<string, boolean>;
}
