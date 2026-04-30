import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { envs } from '../../config/envs';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    if (!envs.metricsEnabled) {
      throw new NotFoundException();
    }

    return this.metricsService.render();
  }
}
