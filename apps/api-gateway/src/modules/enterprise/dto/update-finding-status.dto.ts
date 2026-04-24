import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateFindingStatusDto {
  @IsIn(['OPEN', 'ACCEPTED_RISK', 'FALSE_POSITIVE', 'FIXED'])
  status!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
