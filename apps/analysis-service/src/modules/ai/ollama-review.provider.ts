import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiReviewProvider, GenerateSummaryInput } from './ai-review-provider';
import { RuleBasedReviewProvider } from './rule-based-review.provider';

@Injectable()
export class OllamaReviewProvider implements AiReviewProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly fallbackProvider: RuleBasedReviewProvider,
  ) {}

  async generateSummary(input: GenerateSummaryInput): Promise<string> {
    const baseUrl = this.configService.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434');
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.configService.get<string>('OLLAMA_MODEL', 'llama3.2'),
        stream: false,
        prompt: this.buildPrompt(input),
      }),
    });

    if (!response.ok) {
      return this.fallbackProvider.generateSummary(input);
    }

    const payload = (await response.json()) as { response?: string };
    return payload.response?.trim() || this.fallbackProvider.generateSummary(input);
  }

  private buildPrompt(input: GenerateSummaryInput): string {
    return [
      'Generate a concise technical code review summary.',
      `Repository: ${input.repoUrl}`,
      `Branch: ${input.branch}`,
      `Stack: ${input.detectedStack ?? 'unknown'}`,
      `Risk: ${input.riskScore}/100 ${input.riskLevel}`,
      `Findings: ${JSON.stringify(input.findings.slice(0, 20))}`,
    ].join('\n');
  }
}
