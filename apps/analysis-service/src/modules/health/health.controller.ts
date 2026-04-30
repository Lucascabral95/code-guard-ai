import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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

  @Get('ready')
  @ApiOperation({ summary: 'Check Analysis Service readiness, including PostgreSQL connectivity' })
  @ApiOkResponse({
    description: 'Analysis Service dependencies are ready.',
    schema: {
      example: {
        status: 'ok',
        service: 'analysis-service',
        checks: {
          database: {
            status: 'ok',
            latencyMs: 4,
            pool: {
              redactedUrl:
                'postgresql://***:***@postgres:5432/codeguard?connection_limit=10&pool_timeout=10',
              connectionLimit: 10,
              poolTimeoutSeconds: 10,
              connectTimeoutSeconds: 10,
              applicationName: 'codeguard-analysis-service',
              pgBouncer: false,
            },
          },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({ description: 'One or more dependencies are unavailable.' })
  async getReadiness() {
    try {
      return {
        status: 'ok',
        service: 'analysis-service',
        checks: {
          database: await this.prisma.getReadiness(),
        },
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'analysis-service',
        checks: {
          database: {
            status: 'error',
            message: error instanceof Error ? error.message : 'Database readiness failed.',
          },
        },
      });
    }
  }
}
