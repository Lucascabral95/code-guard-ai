import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @ApiProperty({ enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'CRITICAL' })
  @IsIn(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: string;

  @ApiProperty({ enum: ['WARN', 'FAIL'], example: 'FAIL' })
  @IsIn(['WARN', 'FAIL'])
  action!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: Object, example: { category: 'secrets' } })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
