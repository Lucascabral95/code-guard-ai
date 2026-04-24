import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_REVIEW_PROVIDER } from './ai-review-provider';
import { OllamaReviewProvider } from './ollama-review.provider';
import { RuleBasedReviewProvider } from './rule-based-review.provider';

@Module({
  providers: [
    RuleBasedReviewProvider,
    OllamaReviewProvider,
    {
      provide: AI_REVIEW_PROVIDER,
      inject: [ConfigService, RuleBasedReviewProvider, OllamaReviewProvider],
      useFactory: (
        configService: ConfigService,
        ruleBasedProvider: RuleBasedReviewProvider,
        ollamaProvider: OllamaReviewProvider,
      ) => {
        return configService.get<string>('OLLAMA_ENABLED', 'false') === 'true'
          ? ollamaProvider
          : ruleBasedProvider;
      },
    },
  ],
  exports: [AI_REVIEW_PROVIDER, RuleBasedReviewProvider],
})
export class AiModule {}
