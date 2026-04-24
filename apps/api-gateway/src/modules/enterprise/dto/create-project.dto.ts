import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsGithubRepositoryUrl } from '../../../common/pipes/github-url.validator';

export class CreateProjectDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsGithubRepositoryUrl()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  repoUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  defaultBranch = 'main';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
