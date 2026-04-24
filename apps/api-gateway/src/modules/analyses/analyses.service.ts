import { Injectable } from '@nestjs/common';
import { AnalysisServiceClient } from '../../clients/analysis-service.client';
import { CreateAnalysisDto } from './dto/create-analysis.dto';

@Injectable()
export class AnalysesService {
  constructor(private readonly analysisServiceClient: AnalysisServiceClient) {}

  create(dto: CreateAnalysisDto): Promise<unknown> {
    return this.analysisServiceClient.createAnalysis(dto);
  }

  findAll(): Promise<unknown> {
    return this.analysisServiceClient.listAnalyses();
  }

  findOne(id: string): Promise<unknown> {
    return this.analysisServiceClient.getAnalysis(id);
  }
}
