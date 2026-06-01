import { Injectable } from '@nestjs/common';
import { toRequestActor } from '../../common/auth/actor-query.util';
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
      actor: input.userId ? toRequestActor(input.userId) : undefined,
      activityLegacyId: input.activityLegacyId,
    });
  }

  assessPostImage(
    input: PostModerationInput & { image: string },
  ): Promise<PostModerationResult> {
    return this.riskAgent.assessImage({
      body: input.body,
      image: input.image,
      actor: input.userId ? toRequestActor(input.userId) : undefined,
      activityLegacyId: input.activityLegacyId,
    });
  }

  assessComment(
    input: PostCommentModerationInput,
  ): Promise<PostModerationResult> {
    return this.riskAgent.assessComment({
      body: input.body,
      userId: input.userId,
      postId: input.postId,
    });
  }
}
