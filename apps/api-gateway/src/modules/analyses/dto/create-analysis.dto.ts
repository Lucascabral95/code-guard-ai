import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsGithubRepositoryUrl } from '../../../common/pipes/github-url.validator';

export class CreateAnalysisDto {
  @IsGithubRepositoryUrl()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  repoUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : 'main'))
  branch = 'main';
}
