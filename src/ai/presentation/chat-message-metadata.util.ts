import type { AiStreamEvent, RecommendedActivityCard } from '../../shared/chat';
import type { ChatMessageDto } from '../../shared/chat/chat-message.dto';

export interface ChatMessageImageContext {
  source?: string;
  ocrText?: string;
}

export type ChatMessageRichMetadata = Pick<
  ChatMessageDto,
  'imageContext' | 'recommendedActivity' | 'suggestedReplies'
>;

export function extractAssistantMessageMetadata(
  events: AiStreamEvent[],
): Omit<ChatMessageRichMetadata, 'imageContext'> {
  let recommendedActivity: RecommendedActivityCard | undefined;
  let suggestedReplies: string[] | undefined;

  for (const event of events) {
    if (event.type === 'activity_recommendation' && event.activity) {
      recommendedActivity = event.activity;
    }
    if (event.type === 'suggested_replies' && event.replies.length) {
      suggestedReplies = event.replies;
    }
  }

  return {
    ...(recommendedActivity ? { recommendedActivity } : {}),
    ...(suggestedReplies ? { suggestedReplies } : {}),
  };
}
