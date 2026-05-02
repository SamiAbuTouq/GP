import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches } from 'class-validator';

export class PublishDraftDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{4}$/)
  academicYear?: string;

  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3])
  semesterType?: number;

  @IsOptional()
  @IsBoolean()
  acknowledgedHardConflicts?: boolean;
}
