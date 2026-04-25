import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API Gateway health' })
  @ApiOkResponse({
    description: 'API Gateway is reachable.',
    schema: { example: { status: 'ok', service: 'api-gateway' } },
  })
  getHealth(): { status: 'ok'; service: 'api-gateway' } {
    return {
      status: 'ok',
      service: 'api-gateway',
    };
  }
}
