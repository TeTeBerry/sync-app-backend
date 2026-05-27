import type { AiStreamEvent, RecommendedPostCard } from './ai-stream-event.view';
import type { ChatMessageDto } from './chat-message.dto';

export interface ChatMessageImageContext {
  source?: string;
  ocrText?: string;
}

export type ChatMessageRichMetadata = Pick<
  ChatMessageDto,
  'imageContext' | 'recommendedPosts' | 'createdPost' | 'suggestedReplies'
>;

export function extractAssistantMessageMetadata(
  events: AiStreamEvent[],
): Omit<ChatMessageRichMetadata, 'imageContext'> {
  let recommendedPosts: RecommendedPostCard[] | undefined;
  let createdPost: RecommendedPostCard | undefined;
  let suggestedReplies: string[] | undefined;

  for (const event of events) {
    if (event.type === 'post_recommendations' && event.posts.length) {
      recommendedPosts = event.posts;
    }
    if (event.type === 'post_created' && event.post) {
      createdPost = event.post;
    }
    if (event.type === 'suggested_replies' && event.replies.length) {
      suggestedReplies = event.replies;
    }
  }

  return {
    ...(recommendedPosts ? { recommendedPosts } : {}),
    ...(createdPost ? { createdPost } : {}),
    ...(suggestedReplies ? { suggestedReplies } : {}),
  };
}
