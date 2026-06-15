import { Injectable } from '@nestjs/common';
import { RiskAgent } from '../agents/risk.agent';
import type {
  IPostModerationPort,
  PostModerationAssessOptions,
  PostModerationInput,
  PostModerationResult,
} from '../../modules/partner/ports/post-moderation.port';

@Injectable()
export class PostModerationAdapter implements IPostModerationPort {
  constructor(private readonly riskAgent: RiskAgent) {}

  assessPost(
    input: PostModerationInput,
    options?: PostModerationAssessOptions,
  ): Promise<PostModerationResult> {
    return this.riskAgent.assess(
      {
        body: input.body,
        actor: input.actor,
        activityLegacyId: input.activityLegacyId,
      },
      { rulesOnly: options?.rulesOnly },
    );
  }

  assessPostImage(
    input: PostModerationInput & { image: string },
  ): Promise<PostModerationResult> {
    return this.riskAgent.assessImage({
      body: input.body,
      image: input.image,
      actor: input.actor,
      activityLegacyId: input.activityLegacyId,
    });
  }
}
