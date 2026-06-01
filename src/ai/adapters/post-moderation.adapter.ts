import { Injectable } from '@nestjs/common';
import { RiskAgent } from '../agents/risk.agent';
import type {
  IPostModerationPort,
  PostCommentModerationInput,
  PostModerationInput,
  PostModerationResult,
} from '../../modules/partner/ports/post-moderation.port';

@Injectable()
export class PostModerationAdapter implements IPostModerationPort {
  constructor(private readonly riskAgent: RiskAgent) {}

  assessPost(input: PostModerationInput): Promise<PostModerationResult> {
    return this.riskAgent.assess({
      body: input.body,
      actor: input.actor,
      activityLegacyId: input.activityLegacyId,
    });
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

  assessComment(
    input: PostCommentModerationInput,
  ): Promise<PostModerationResult> {
    return this.riskAgent.assessComment({
      body: input.body,
      actor: input.actor,
      postId: input.postId,
    });
  }
}
