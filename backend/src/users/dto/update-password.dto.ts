import { IsString, MinLength, Matches } from "class-validator";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_NUMBER_PATTERN,
  PASSWORD_SPECIAL_CHAR_PATTERN,
  PASSWORD_UPPERCASE_PATTERN,
} from "../../common/password-policy";

export class UpdatePasswordDto {
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: "Password must be at least 8 characters long",
  })
  @Matches(PASSWORD_UPPERCASE_PATTERN, {
    message: "Password must contain at least one uppercase letter",
  })
  @Matches(PASSWORD_NUMBER_PATTERN, {
    message: "Password must contain at least one number",
  })
  @Matches(PASSWORD_SPECIAL_CHAR_PATTERN, {
    message: "Password must contain at least one special character (@$!%*?&)",
  })
  new_password!: string;
}
