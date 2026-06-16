import type { RequestActor } from '../../../common/auth/request-actor.types';

export interface PostModerationInput {
  body: string;
  actor: RequestActor;
  activityLegacyId?: number;
  image?: string;
}

export interface PostModerationResult {
  publishable: boolean;
  reason?: string;
  sanitizedBody?: string;
}

export interface PostModerationAssessOptions {
  /** Skip LLM when structured form posts already passed rule + duplicate checks. */
  rulesOnly?: boolean;
}

export interface IPostModerationPort {
  assessPost(
    input: PostModerationInput,
    options?: PostModerationAssessOptions,
  ): Promise<PostModerationResult>;
  assessPostImage(
    input: PostModerationInput & { image: string },
  ): Promise<PostModerationResult>;
}

export const POST_MODERATION_PORT = Symbol('POST_MODERATION_PORT');
