import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FindingStatus } from '@prisma/client';

export class UpdateFindingStatusDto {
  @IsEnum(FindingStatus)
  status!: FindingStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
