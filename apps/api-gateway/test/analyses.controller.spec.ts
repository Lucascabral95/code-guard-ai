import { Test } from '@nestjs/testing';
import { AnalysesController } from '../src/modules/analyses/analyses.controller';
import { AnalysesService } from '../src/modules/analyses/analyses.service';

describe('AnalysesController', () => {
  let controller: AnalysesController;
  const analysesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AnalysesController],
      providers: [{ provide: AnalysesService, useValue: analysesService }],
    }).compile();

    controller = moduleRef.get(AnalysesController);
    jest.clearAllMocks();
  });

  it('forwards create analysis requests to the service', async () => {
    const dto = { repoUrl: 'https://github.com/vercel/next.js', branch: 'main' };
    analysesService.create.mockResolvedValue({ id: 'analysis-id', ...dto });

    await expect(controller.create(dto)).resolves.toMatchObject({ id: 'analysis-id' });
    expect(analysesService.create).toHaveBeenCalledWith(dto);
  });

  it('forwards analysis detail requests to the service', async () => {
    analysesService.findOne.mockResolvedValue({ analysis: { id: 'analysis-id' } });

    await expect(controller.findOne('analysis-id')).resolves.toMatchObject({
      analysis: { id: 'analysis-id' },
    });
    expect(analysesService.findOne).toHaveBeenCalledWith('analysis-id');
  });
});
