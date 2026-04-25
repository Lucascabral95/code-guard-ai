import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class FailAnalysisDto {
  @ApiProperty({
    example: 'git clone failed: repository not found',
    description: 'Human-readable failure reason reported by the analyzer worker.',
  })
  @IsString()
  errorMessage!: string;
}
