import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateLinkDto {
  @IsIn(["product", "store", "collection"])
  type: "product" | "store" | "collection";

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productHandle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  collectionSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  /**
   * Echo of the product's `guidelinesHash` — proves the creator read & accepted
   * the compliance pack. Required when the product has one (enforced server-side).
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  acknowledgedGuidelinesHash?: string;

  // ── Campaign tagging (optional — absent ⇒ the single default link) ──────────
  @IsOptional()
  @IsString()
  @MaxLength(80)
  campaignLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  utmSourceOverride?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  utmMediumOverride?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
