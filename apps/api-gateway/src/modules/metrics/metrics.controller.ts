import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller()
export class MetricsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get('metrics')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metrics(): string {
    if (this.configService.get<string>('METRICS_ENABLED', 'true') !== 'true') {
      throw new NotFoundException();
    }

    return this.metricsService.render();
  }
}
