import { Module } from '@nestjs/common';
import { PdfReportService } from './pdf-report.service';
import { ReportBuilderService } from './report-builder.service';
import { RiskScoringService } from './risk-scoring.service';

@Module({
  providers: [RiskScoringService, ReportBuilderService, PdfReportService],
  exports: [RiskScoringService, ReportBuilderService, PdfReportService],
})
export class ReportsModule {}
