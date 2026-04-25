import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { FindingStatus } from '@prisma/client';

export class UpdateFindingStatusDto {
  @ApiProperty({
    enum: FindingStatus,
    example: FindingStatus.ACCEPTED_RISK,
    description: 'Lifecycle status assigned to the finding.',
  })
  @IsEnum(FindingStatus)
  status!: FindingStatus;

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
