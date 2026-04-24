import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AnalysesService } from '../application/analyses.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';

@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Post()
  create(@Body() dto: CreateAnalysisDto) {
    return this.analysesService.create(dto);
  }

  @Get()
  findAll() {
    return this.analysesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.analysesService.findOne(id);
  }
}
