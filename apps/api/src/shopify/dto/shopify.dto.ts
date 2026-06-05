import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

// Trim pasted values before validation (transform runs first when transform:true).
// Guard against non-string input so .trim() never throws.
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class ConnectShopifyDto {
  @Transform(trim)
  @IsString()
  @MinLength(10)
  accessToken: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  shopDomain: string; // e.g. taravee.myshopify.com
}

export class ClientCredentialsConnectDto {
  // Optional — falls back to SHOPIFY_STORE_DOMAIN (or the existing connection).
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  shopDomain?: string;
}

export class SetListedDto {
  @IsBoolean()
  listed: boolean;
}

// Commission rate is a FRACTION (0..1). null clears the override (use creator
// default). @ValidateIf skips the numeric checks when the value is explicitly null.
export class SetCommissionDto {
  @ValidateIf((o) => o.commissionRate !== null)
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate: number | null;
}

export class BulkListedDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  ids: string[];

  @IsBoolean()
  listed: boolean;
}

export class BulkCommissionDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  ids: string[];

  @ValidateIf((o) => o.commissionRate !== null)
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate: number | null;
}

// ─── Content guidelines (admin-authored posting brief) ───────────────────────

const LONG = 4000;
const SHORT = 280;

export class ContentGuidelinesDto {
  @IsOptional() @IsString() @MaxLength(LONG) reel?: string;
  @IsOptional() @IsString() @MaxLength(LONG) story?: string;
  @IsOptional() @IsString() @MaxLength(LONG) post?: string;
  @IsOptional() @IsString() @MaxLength(LONG) generalNotes?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) disclosure?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  requiredHashtags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  requiredMentions?: string[];

  @IsOptional() @IsString() @MaxLength(LONG) prohibitedClaims?: string;
  @IsOptional() @IsString() @MaxLength(LONG) healthDisclaimer?: string;
}

export class SetGuidelinesDto {
  // null clears the brief; an object replaces it. Validated only when an object.
  @IsOptional()
  @ValidateIf((o) => o.guidelines !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => ContentGuidelinesDto)
  guidelines?: ContentGuidelinesDto | null;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

export class SetGuidelinesVisibilityDto {
  @IsBoolean()
  visible: boolean;
}

export class SetComplianceHoldDto {
  @IsBoolean()
  hold: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string;
}

export class BulkGuidelinesVisibilityDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  ids: string[];

  @IsBoolean()
  visible: boolean;
}
