import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PolicyAction, Severity } from '@prisma/client';

export class CreatePolicyDto {
  @ApiProperty({ example: 'Block critical vulnerabilities', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({
    example: 'Fails policy evaluation when open critical findings are present.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 'security' })
  @IsString()
  @MaxLength(80)
  category!: string;

  @ApiProperty({ enum: Severity, example: Severity.CRITICAL })
  @IsEnum(Severity)
  severity!: Severity;

  @ApiProperty({ enum: PolicyAction, example: PolicyAction.FAIL })
  @IsEnum(PolicyAction)
  action!: PolicyAction;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: Object, example: { category: 'secrets' } })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
