import { extractAssistantMessageMetadata } from '@src/ai/presentation/chat-message-metadata.util';

describe('extractAssistantMessageMetadata', () => {
  it('collects cards and suggested replies from stream events', () => {
    expect(
      extractAssistantMessageMetadata([
        { type: 'delta', content: 'hello' },
        {
          type: 'activity_recommendation',
          activity: {
            activityLegacyId: 4,
            title: '风暴电音节',
            date: '06/13-14',
            venue: '深圳',
          },
        },
        { type: 'suggested_replies', replies: ['好的'] },
      ]),
    ).toEqual({
      recommendedActivity: {
        activityLegacyId: 4,
        title: '风暴电音节',
        date: '06/13-14',
        venue: '深圳',
      },
      suggestedReplies: ['好的'],
    });
  });
});
