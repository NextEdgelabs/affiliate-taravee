import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

const THEMES = ["gold", "midnight", "rose", "emerald"] as const;

export class CreateCollectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsIn(THEMES)
  theme?: (typeof THEMES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  productHandles?: string[];
}

export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsIn(THEMES)
  theme?: (typeof THEMES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  productHandles?: string[];
}
