import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: 'Matched insecure dependency declaration' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: '"lodash": "4.17.15"', nullable: true })
  @IsOptional()
  @IsString()
  snippet?: string | null;

  @ApiPropertyOptional({ example: 'package.json', nullable: true })
  @IsOptional()
  @IsString()
  file?: string | null;

  @ApiPropertyOptional({ example: 42, nullable: true })
  @IsOptional()
  @IsInt()
  lineStart?: number | null;

  @ApiPropertyOptional({ example: 45, nullable: true })
  @IsOptional()
  @IsInt()
  lineEnd?: number | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown> | null;
}

export class ResultRemediationDto {
  @ApiProperty({ example: 'Upgrade vulnerable dependency' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'Upgrade lodash to a patched version and regenerate the lockfile.' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ example: 'medium', nullable: true })
  @IsOptional()
  @IsString()
  effort?: string | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  priority?: number;
}

export class ResultFindingDto {
  @ApiProperty({ enum: FindingType, example: FindingType.SECURITY })
  @IsEnum(FindingType)
  type!: FindingType;

  @ApiProperty({ enum: Severity, example: Severity.HIGH })
  @IsEnum(Severity)
  severity!: Severity;

  @ApiPropertyOptional({
    example: 'semgrep-safe:src/auth.ts:hardcoded-secret',
    nullable: true,
    description: 'Stable fingerprint used for deduplication across scans.',
  })
  @IsOptional()
  @IsString()
  fingerprint?: string | null;

  @ApiPropertyOptional({ example: 'secrets', nullable: true })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({ example: 0.92, nullable: true, minimum: 0, maximum: 1 })
  @IsOptional()
  confidence?: number | null;

  @ApiPropertyOptional({ example: 'CWE-798', nullable: true })
  @IsOptional()
  @IsString()
  cwe?: string | null;

  @ApiPropertyOptional({ example: 'CVE-2024-12345', nullable: true })
  @IsOptional()
  @IsString()
  cve?: string | null;

  @ApiPropertyOptional({ example: 8.8, nullable: true })
  @IsOptional()
  cvss?: number | null;

  @ApiPropertyOptional({ example: 0.021, nullable: true })
  @IsOptional()
  epss?: number | null;

  @ApiProperty({ example: 'semgrep-safe', maxLength: 128 })
  @IsString()
  @MaxLength(128)
  tool!: string;

  @ApiPropertyOptional({ example: 'src/auth.ts', nullable: true })
  @IsOptional()
  @IsString()
  file?: string | null;

  @ApiPropertyOptional({ example: 17, nullable: true })
  @IsOptional()
  @IsInt()
  line?: number | null;

  @ApiProperty({ example: 'Potential secret-like value detected' })
  @IsString()
  message!: string;

  @ApiPropertyOptional({
    example: 'Move secrets to environment variables or a managed secret store.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  recommendation?: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: () => [ResultEvidenceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultEvidenceDto)
  evidences?: ResultEvidenceDto[];

  @ApiPropertyOptional({ type: () => ResultRemediationDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ResultRemediationDto)
  remediation?: ResultRemediationDto | null;
}

export class ResultLogDto {
  @ApiProperty({ enum: LogLevel, example: LogLevel.INFO })
  @IsEnum(LogLevel)
  level!: LogLevel;

  @ApiProperty({ example: 'Repository cloned successfully' })
  @IsString()
  message!: string;
}

export class ResultToolRunDto {
  @ApiProperty({ example: 'trivy' })
  @IsString()
  tool!: string;

  @ApiProperty({ example: 'dependency-scan' })
  @IsString()
  stage!: string;

  @ApiProperty({ example: 'COMPLETED' })
  @IsString()
  status!: string;

  @ApiPropertyOptional({ example: 1240, nullable: true })
  @IsOptional()
  @IsInt()
  durationMs?: number | null;

  @ApiPropertyOptional({ example: 0, nullable: true })
  @IsOptional()
  @IsInt()
  exitCode?: number | null;

  @ApiPropertyOptional({ example: 'Detected 3 vulnerabilities', nullable: true })
  @IsOptional()
  @IsString()
  summary?: string | null;

  @ApiPropertyOptional({ example: 'Tool timed out after 60s', nullable: true })
  @IsOptional()
  @IsString()
  errorMessage?: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown> | null;
}

export class ResultArtifactDto {
  @ApiProperty({ example: 'sarif' })
  @IsString()
  kind!: string;

  @ApiProperty({ example: 'semgrep.sarif' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'application/sarif+json' })
  @IsString()
  contentType!: string;

  @ApiPropertyOptional({ example: 'artifacts/scan-123/semgrep.sarif', nullable: true })
  @IsOptional()
  @IsString()
  path?: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown> | null;
}

export class ResultComponentDto {
  @ApiProperty({ example: 'next' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '15.0.0', nullable: true })
  @IsOptional()
  @IsString()
  version?: string | null;

  @ApiPropertyOptional({ example: 'npm', nullable: true })
  @IsOptional()
  @IsString()
  ecosystem?: string | null;

  @ApiPropertyOptional({ example: 'pkg:npm/next@15.0.0', nullable: true })
  @IsOptional()
  @IsString()
  packageUrl?: string | null;

  @ApiPropertyOptional({ example: 'MIT', nullable: true })
  @IsOptional()
  @IsString()
  license?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  direct?: boolean;
}

export class ResultLicenseRiskDto {
  @ApiProperty({ example: 'left-pad' })
  @IsString()
  component!: string;

  @ApiProperty({ example: 'GPL-3.0' })
  @IsString()
  license!: string;

  @ApiProperty({ example: 'HIGH' })
  @IsString()
  risk!: string;

  @ApiPropertyOptional({ example: 'copyleft-restricted', nullable: true })
  @IsOptional()
  @IsString()
  policy?: string | null;
}

export class ResultVulnerabilityDto {
  @ApiPropertyOptional({ example: 'lodash', nullable: true })
  @IsOptional()
  @IsString()
  componentName?: string | null;

  @ApiPropertyOptional({ example: '4.17.15', nullable: true })
  @IsOptional()
  @IsString()
  version?: string | null;

  @ApiPropertyOptional({ example: 'npm', nullable: true })
  @IsOptional()
  @IsString()
  ecosystem?: string | null;

  @ApiProperty({ example: 'trivy' })
  @IsString()
  source!: string;

  @ApiProperty({ example: 'CVE-2024-12345' })
  @IsString()
  externalId!: string;

  @ApiProperty({ enum: Severity, example: Severity.HIGH })
  @IsEnum(Severity)
  severity!: Severity;

  @ApiPropertyOptional({ example: 8.8, nullable: true })
  @IsOptional()
  cvss?: number | null;

  @ApiPropertyOptional({ example: 0.012, nullable: true })
  @IsOptional()
  epss?: number | null;

  @ApiPropertyOptional({ example: '4.17.21', nullable: true })
  @IsOptional()
  @IsString()
  fixedVersion?: string | null;

  @ApiProperty({ example: 'Prototype pollution in lodash' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Vulnerable transitive dependency detected.', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 'https://avd.aquasec.com/nvd/cve-2024-12345', nullable: true })
  @IsOptional()
  @IsString()
  url?: string | null;
}

export class CompleteAnalysisResultDto {
  @ApiPropertyOptional({ example: 'node', nullable: true })
  @IsOptional()
  @IsString()
  detectedStack?: string | null;

  @ApiProperty({ type: () => [ResultFindingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultFindingDto)
  findings!: ResultFindingDto[];

  @ApiProperty({ type: () => [ResultLogDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultLogDto)
  logs!: ResultLogDto[];

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  rawSummary?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: () => [ResultToolRunDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultToolRunDto)
  toolRuns?: ResultToolRunDto[];

  @ApiPropertyOptional({ type: () => [ResultArtifactDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultArtifactDto)
  artifacts?: ResultArtifactDto[];

  @ApiPropertyOptional({ type: () => [ResultComponentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultComponentDto)
  components?: ResultComponentDto[];

  @ApiPropertyOptional({ type: () => [ResultLicenseRiskDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultLicenseRiskDto)
  licenseRisks?: ResultLicenseRiskDto[];

  @ApiPropertyOptional({ type: () => [ResultVulnerabilityDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultVulnerabilityDto)
  vulnerabilities?: ResultVulnerabilityDto[];
}
