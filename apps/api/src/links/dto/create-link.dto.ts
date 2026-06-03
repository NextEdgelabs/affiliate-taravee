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
}
