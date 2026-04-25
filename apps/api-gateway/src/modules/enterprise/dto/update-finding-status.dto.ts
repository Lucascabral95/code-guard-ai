import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateFindingStatusDto {
  @ApiProperty({
    enum: ['OPEN', 'ACCEPTED_RISK', 'FALSE_POSITIVE', 'FIXED', 'REOPENED'],
    example: 'ACCEPTED_RISK',
    description: 'Lifecycle status assigned to the finding.',
  })
  @IsIn(['OPEN', 'ACCEPTED_RISK', 'FALSE_POSITIVE', 'FIXED', 'REOPENED'])
  status!: string;

  @ApiPropertyOptional({
    example: 'Temporarily accepted until the next dependency upgrade window.',
    description: 'Required business context when accepting risk or marking a false positive.',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Expiration date for accepted risk decisions.',
  })
  @IsOptional()
  @IsDateString()
  acceptedUntil?: string;
}
