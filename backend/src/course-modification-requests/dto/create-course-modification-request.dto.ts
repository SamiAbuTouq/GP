import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateCourseModificationRequestDto {
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsOptional()
  addCourseIds?: number[];

  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsOptional()
  removeCourseIds?: number[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}
