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

export class ResultEvidenceDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  snippet?: string | null;

  @IsOptional()
  @IsString()
  file?: string | null;

  @IsOptional()
  @IsInt()
  lineStart?: number | null;

  @IsOptional()
  @IsInt()
  lineEnd?: number | null;

  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown> | null;
}

export class ResultRemediationDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  effort?: string | null;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class ResultFindingDto {
  @IsEnum(FindingType)
  type!: FindingType;

  @IsEnum(Severity)
  severity!: Severity;

  @IsOptional()
  @IsString()
  fingerprint?: string | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  confidence?: number | null;

  @IsOptional()
  @IsString()
  cwe?: string | null;

  @IsOptional()
  @IsString()
  cve?: string | null;

  @IsOptional()
  cvss?: number | null;

  @IsOptional()
  epss?: number | null;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultEvidenceDto)
  evidences?: ResultEvidenceDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ResultRemediationDto)
  remediation?: ResultRemediationDto | null;
}

export class ResultLogDto {
  @IsEnum(LogLevel)
  level!: LogLevel;

  @IsString()
  message!: string;
}

export class ResultToolRunDto {
  @IsString()
  tool!: string;

  @IsString()
  stage!: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsInt()
  durationMs?: number | null;

  @IsOptional()
  @IsInt()
  exitCode?: number | null;

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsString()
  errorMessage?: string | null;

  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown> | null;
}

export class ResultArtifactDto {
  @IsString()
  kind!: string;

  @IsString()
  name!: string;

  @IsString()
  contentType!: string;

  @IsOptional()
  @IsString()
  path?: string | null;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown> | null;
}

export class ResultComponentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  version?: string | null;

  @IsOptional()
  @IsString()
  ecosystem?: string | null;

  @IsOptional()
  @IsString()
  packageUrl?: string | null;

  @IsOptional()
  @IsString()
  license?: string | null;

  @IsOptional()
  direct?: boolean;
}

export class ResultLicenseRiskDto {
  @IsString()
  component!: string;

  @IsString()
  license!: string;

  @IsString()
  risk!: string;

  @IsOptional()
  @IsString()
  policy?: string | null;
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultToolRunDto)
  toolRuns?: ResultToolRunDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultArtifactDto)
  artifacts?: ResultArtifactDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultComponentDto)
  components?: ResultComponentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultLicenseRiskDto)
  licenseRisks?: ResultLicenseRiskDto[];
}
