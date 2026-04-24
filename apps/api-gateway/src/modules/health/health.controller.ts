import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: 'ok'; service: 'api-gateway' } {
    return {
      status: 'ok',
      service: 'api-gateway',
    };
  }
}
