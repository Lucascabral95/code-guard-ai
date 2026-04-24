import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { CreateAnalysisDto } from '../modules/analyses/dto/create-analysis.dto';

@Injectable()
export class AnalysisServiceClient {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    this.baseUrl = configService.get<string>('ANALYSIS_SERVICE_URL', 'http://localhost:3002');
  }

  async createAnalysis(body: CreateAnalysisDto): Promise<unknown> {
    return this.forward('post', '/analyses', body);
  }

  async listAnalyses(): Promise<unknown> {
    return this.forward('get', '/analyses');
  }

  async getAnalysis(id: string): Promise<unknown> {
    return this.forward('get', `/analyses/${encodeURIComponent(id)}`);
  }

  private async forward(method: 'get' | 'post', path: string, body?: unknown): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url: `${this.baseUrl}${path}`,
          data: body,
        }),
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        throw new BadGatewayException({
          message: 'Analysis service rejected the gateway request',
          upstreamStatus: error.response.status,
          upstreamBody: error.response.data,
        });
      }

      throw new BadGatewayException('Analysis service is unavailable');
    }
  }
}
