import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import { MetricsDto } from "../../auth/dto/register.dto";

export class SetPayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  upiId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  bankAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankIfsc?: string;
}

export class ApproveCreatorDto {
  /** Commission as a fraction, e.g. 0.10 for 10%. Optional (defaults to 0.10). */
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;
}

export class RejectCreatorDto {
  @IsString()
  @MinLength(1)
  reason: string;
}

export class SetCommissionDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate: number;
}

export class SetCreatorStatusDto {
  @IsIn(["active", "suspended"])
  status: "active" | "suspended";
}

export class AdminCreateCreatorDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  /** Optional — if omitted a temp password is generated and returned once. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  @Matches(/^@?[A-Za-z0-9._]{1,40}$/, { message: "Invalid Instagram username" })
  instagramUsername?: string;

  @IsOptional()
  @IsString()
  @Matches(/^@?[A-Za-z0-9._\- ]{1,60}$/, { message: "Invalid YouTube channel" })
  youtubeChannel?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetricsDto)
  metrics?: MetricsDto;

  /** Commission as a fraction (0..1). Applies when approve=true. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  /** Create already-approved (active + refCode) instead of pending. */
  @IsOptional()
  @IsBoolean()
  approve?: boolean;
}
