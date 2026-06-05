import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class SetLinkStatusDto {
  @IsIn(["active", "disabled"])
  status: "active" | "disabled";

  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string;
}
