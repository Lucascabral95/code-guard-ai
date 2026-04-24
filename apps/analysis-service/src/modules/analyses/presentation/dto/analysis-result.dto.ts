import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FindingType, LogLevel, Severity } from '@prisma/client';

export class ResultFindingDto {
  @IsEnum(FindingType)
  type!: FindingType;

  @IsEnum(Severity)
  severity!: Severity;

  @IsString()
  @MaxLength(128)
  tool!: string;

  @IsOptional()
  @IsString()
  file?: string | null;

  @IsOptional()
  @IsInt()
  line?: number | null;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  recommendation?: string | null;

  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown> | null;
}

export class ResultLogDto {
  @IsEnum(LogLevel)
  level!: LogLevel;

  @IsString()
  message!: string;
}

export class CompleteAnalysisResultDto {
  @IsOptional()
  @IsString()
  detectedStack?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultFindingDto)
  findings!: ResultFindingDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultLogDto)
  logs!: ResultLogDto[];

  @IsOptional()
  @IsObject()
  rawSummary?: Record<string, unknown> | null;
}
