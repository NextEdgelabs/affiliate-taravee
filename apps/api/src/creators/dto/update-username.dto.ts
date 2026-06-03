import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateUsernameDto {
  // Format/reserved/uniqueness are fully validated server-side in updateUsername.
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  username: string;
}
