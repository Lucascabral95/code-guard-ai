import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateScanDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  branch = 'main';
}
