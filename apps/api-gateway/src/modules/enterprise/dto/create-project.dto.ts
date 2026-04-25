import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsGithubRepositoryUrl } from '../../../common/pipes/github-url.validator';

export class CreateProjectDto {
  @ApiProperty({
    example: 'Vercel Next.js',
    maxLength: 160,
    description: 'Human-readable project name shown in the enterprise portfolio.',
  })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty({
    example: 'https://github.com/vercel/next.js',
    description: 'Public GitHub repository URL linked to this project.',
  })
  @IsGithubRepositoryUrl()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  repoUrl!: string;

  @ApiPropertyOptional({
    example: 'main',
    default: 'main',
    maxLength: 128,
    description: 'Default branch used when a scan does not provide an explicit branch.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  defaultBranch = 'main';

  @ApiPropertyOptional({
    example: 'Reference frontend framework monitored for AppSec and supply-chain risk.',
    maxLength: 500,
    description: 'Optional business or technical context for the project.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
