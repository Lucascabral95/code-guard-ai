import { Module } from '@nestjs/common';
import { envs } from '../../config/envs';
import { AI_REVIEW_PROVIDER } from './ai-review-provider';
import { OllamaReviewProvider } from './ollama-review.provider';
import { RuleBasedReviewProvider } from './rule-based-review.provider';

@Module({
  providers: [
    RuleBasedReviewProvider,
    OllamaReviewProvider,
    {
      provide: AI_REVIEW_PROVIDER,
      inject: [RuleBasedReviewProvider, OllamaReviewProvider],
      useFactory: (
        ruleBasedProvider: RuleBasedReviewProvider,
        ollamaProvider: OllamaReviewProvider,
      ) => {
        return envs.ollamaEnabled ? ollamaProvider : ruleBasedProvider;
      },
    },
  ],
  exports: [AI_REVIEW_PROVIDER, RuleBasedReviewProvider],
})
export class AiModule {}
