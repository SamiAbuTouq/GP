// Unit tests for UpdatePasswordDto validation rules in the Users module.
import { validate } from "class-validator";
import { UpdatePasswordDto } from "./update-password.dto";

function buildDto(password: string): UpdatePasswordDto {
  const dto = new UpdatePasswordDto();
  dto.new_password = password;
  return dto;
}

describe("UpdatePasswordDto", () => {
  it("passes validation for a valid password", async () => {
    const errors = await validate(buildDto("ValidPass1@"));
    expect(errors).toHaveLength(0);
  });

  it("fails when uppercase is missing with matches constraint", async () => {
    const errors = await validate(buildDto("validpass1@"));
    expect(errors[0]?.constraints).toHaveProperty("matches");
  });

  it("fails when number is missing with matches constraint", async () => {
    const errors = await validate(buildDto("ValidPassword@"));
    expect(errors[0]?.constraints).toHaveProperty("matches");
  });

  it("fails when special character is missing with matches constraint", async () => {
    const errors = await validate(buildDto("ValidPass1"));
    expect(errors[0]?.constraints).toHaveProperty("matches");
  });

  it("fails when under 8 chars with minLength constraint", async () => {
    const errors = await validate(buildDto("Va1@pa"));
    expect(errors[0]?.constraints).toHaveProperty("minLength");
  });
});
