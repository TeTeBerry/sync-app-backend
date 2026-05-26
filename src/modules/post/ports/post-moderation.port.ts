export interface PostModerationInput {
  body: string;
  userId?: string;
  activityLegacyId?: number;
  image?: string;
}

export interface PostCommentModerationInput {
  body: string;
  userId?: string;
  postId?: string;
}

export interface PostModerationResult {
  publishable: boolean;
  reason?: string;
  sanitizedBody?: string;
}

export interface IPostModerationPort {
  assessPost(input: PostModerationInput): Promise<PostModerationResult>;
  assessPostImage(input: PostModerationInput & { image: string }): Promise<PostModerationResult>;
  assessComment(input: PostCommentModerationInput): Promise<PostModerationResult>;
}

export const POST_MODERATION_PORT = Symbol('POST_MODERATION_PORT');
