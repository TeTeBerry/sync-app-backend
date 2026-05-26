export type AiStreamEvent =
  | { type: 'delta'; content: string }
  | {
      type: 'done';
      messageId?: string;
      sessionId?: string;
    }
  | {
      type: 'post_created';
      postId: string;
      activityLegacyId?: number;
    }
  | { type: 'error'; message: string };
