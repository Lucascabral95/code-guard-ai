import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateFindingStatusDto {
  @ApiProperty({
    enum: ['OPEN', 'ACCEPTED_RISK', 'FALSE_POSITIVE', 'FIXED'],
    example: 'ACCEPTED_RISK',
    description: 'Lifecycle status assigned to the finding.',
  })
  @IsIn(['OPEN', 'ACCEPTED_RISK', 'FALSE_POSITIVE', 'FIXED'])
  status!: string;

  @ApiPropertyOptional({
    example: 'Temporarily accepted until the next dependency upgrade window.',
    description: 'Required business context when accepting risk or marking a false positive.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
