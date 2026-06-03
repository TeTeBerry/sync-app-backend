import type {
  AiStreamEvent,
  RecommendedActivityCard,
  RecommendedPostCard,
} from './ai-stream-event.view';
import type { ChatMessageDto } from '../../shared/chat/chat-message.dto';

export interface ChatMessageImageContext {
  source?: string;
  ocrText?: string;
}

export type ChatMessageRichMetadata = Pick<
  ChatMessageDto,
  | 'imageContext'
  | 'recommendedPosts'
  | 'recommendedActivity'
  | 'createdPost'
  | 'suggestedReplies'
>;

export function extractAssistantMessageMetadata(
  events: AiStreamEvent[],
): Omit<ChatMessageRichMetadata, 'imageContext'> {
  let recommendedPosts: RecommendedPostCard[] | undefined;
  let recommendedActivity: RecommendedActivityCard | undefined;
  let createdPost: RecommendedPostCard | undefined;
  let suggestedReplies: string[] | undefined;

  for (const event of events) {
    if (event.type === 'activity_recommendation' && event.activity) {
      recommendedActivity = event.activity;
    }
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
    ...(recommendedActivity ? { recommendedActivity } : {}),
    ...(createdPost ? { createdPost } : {}),
    ...(suggestedReplies ? { suggestedReplies } : {}),
  };
}
