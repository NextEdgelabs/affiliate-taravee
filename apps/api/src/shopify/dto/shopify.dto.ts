import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
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
