import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateScanDto {
  @ApiPropertyOptional({
    example: 'main',
    default: 'main',
    maxLength: 128,
    description: 'Repository branch to scan for this execution.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  branch = 'main';
}
