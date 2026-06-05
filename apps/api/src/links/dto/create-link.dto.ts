import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateLinkDto {
  @IsIn(["product", "store"])
  type: "product" | "store";

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productHandle?: string;

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
}
