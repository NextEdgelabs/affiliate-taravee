import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { IsEmail } from "class-validator";

export class MetricsDto {
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  igFollowers: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  igAvgViews: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  ytSubscribers: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  ytAvgViews: number;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  name: string;

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
}
