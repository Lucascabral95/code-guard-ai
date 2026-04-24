import { validate } from 'class-validator';
import { CreateAnalysisDto } from '../src/modules/analyses/dto/create-analysis.dto';

describe('CreateAnalysisDto validation', () => {
  it('accepts public GitHub repository URLs', async () => {
    const dto = new CreateAnalysisDto();
    dto.repoUrl = 'https://github.com/vercel/next.js';
    dto.branch = 'main';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects non-GitHub URLs', async () => {
    const dto = new CreateAnalysisDto();
    dto.repoUrl = 'https://example.com/vercel/next.js';
    dto.branch = 'main';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('repoUrl');
  });
});
