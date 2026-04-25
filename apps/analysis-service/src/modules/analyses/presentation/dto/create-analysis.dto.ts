import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsGithubRepositoryUrl } from '../../../../common/validators/github-url.validator';

export class CreateAnalysisDto {
  @ApiProperty({
    example: 'https://github.com/vercel/next.js',
    description:
      'Public GitHub repository URL to analyze. Only github.com HTTPS URLs are accepted.',
  })
  @IsGithubRepositoryUrl()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  repoUrl!: string;

  @ApiPropertyOptional({
    example: 'main',
    default: 'main',
    description: 'Git branch to scan. Defaults to main when omitted or blank.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : 'main'))
  branch = 'main';
}
