import { IsOptional, IsString, MaxLength } from "class-validator";

export class RejectCourseModificationRequestDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
