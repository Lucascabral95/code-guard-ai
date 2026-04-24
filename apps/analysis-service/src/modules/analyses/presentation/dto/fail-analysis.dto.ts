import { IsString } from 'class-validator';

export class FailAnalysisDto {
  @IsString()
  errorMessage!: string;
}
