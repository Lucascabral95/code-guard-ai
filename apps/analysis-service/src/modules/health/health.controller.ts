import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: 'ok'; service: 'analysis-service' } {
    return {
      status: 'ok',
      service: 'analysis-service',
    };
  }
}
