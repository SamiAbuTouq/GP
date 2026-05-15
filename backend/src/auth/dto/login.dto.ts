import { IsEmail, IsString, IsNotEmpty, MinLength } from "class-validator";
import { PASSWORD_MIN_LENGTH } from "../../common/password-policy";

export class LoginDto {
  @IsEmail({}, { message: "Invalid email format" })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: "Password must be at least 8 characters",
  })
  password: string;
}
