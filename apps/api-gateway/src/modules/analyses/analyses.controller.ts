import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AnalysesService } from './analyses.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';

@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Post()
  create(@Body() dto: CreateAnalysisDto): Promise<unknown> {
    return this.analysesService.create(dto);
  }

  @Get()
  findAll(): Promise<unknown> {
    return this.analysesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<unknown> {
    return this.analysesService.findOne(id);
  }
}
