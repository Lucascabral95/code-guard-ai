import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check Analysis Service health' })
  @ApiOkResponse({
    description: 'Analysis Service is reachable.',
    schema: { example: { status: 'ok', service: 'analysis-service' } },
  })
  getHealth(): { status: 'ok'; service: 'analysis-service' } {
    return {
      status: 'ok',
      service: 'analysis-service',
    };
  }
}
