import type { AiStreamEvent } from '../../src/shared/chat/ai-stream-event.types';
import type { RecommendedPostCard } from '../../src/shared/chat/chat-cards.types';
import { CONVERSATION_STATE_VERSION } from '../../src/shared/chat/conversation-state.types';

const STREAM_EVENT_TYPES: AiStreamEvent['type'][] = [
  'delta',
  'message_complete',
  'done',
  'post_created',
  'existing_post',
  'activity_recommendation',
  'suggested_replies',
  'conversation_patch',
  'travel_guide_ready',
  'travel_guide_job',
  'itinerary_ready',
  'personality_result_ready',
  'activity_registered',
  'comment_added',
  'client_action',
  'error',
];

const samplePost: RecommendedPostCard = {
  postId: 'p1',
  snippet: '求组队',
  authorName: 'Zara',
  eventTitle: '风暴电音节',
};

describe('chat AiStreamEvent contract', () => {
  it('documents every stream frame variant', () => {
    const samples: AiStreamEvent[] = [
      { type: 'delta', content: 'hi' },
      { type: 'message_complete', content: 'done', requestId: 'req-1' },
      { type: 'done', messageId: 'm1', sessionId: 's1' },
      {
        type: 'post_created',
        postId: 'p1',
        activityLegacyId: 4,
        post: samplePost,
      },
      { type: 'existing_post', postId: 'p1', activityLegacyId: 4 },
      {
        type: 'activity_recommendation',
        activity: {
          activityLegacyId: 4,
          title: '风暴电音节',
          date: '06/13',
          venue: '深圳',
        },
      },
      { type: 'suggested_replies', replies: ['好的', '换一个'] },
      {
        type: 'conversation_patch',
        state: { version: CONVERSATION_STATE_VERSION, flow: 'idle' },
      },
      {
        type: 'travel_guide_job',
        jobId: 'job-1',
        guideId: 'g1',
        activityLegacyId: 4,
        form: {
          departure: '上海',
          headcount: 2,
          budgetTier: 'standard',
          selfDrive: false,
          accommodationNights: 2,
        },
      },
      {
        type: 'travel_guide_ready',
        guideId: 'g1',
        plan: { activityName: 'EDC' },
        form: {
          departure: '上海',
          headcount: 2,
          budgetTier: 'standard',
          selfDrive: false,
          accommodationNights: 2,
        },
      },
      {
        type: 'itinerary_ready',
        itineraryId: 'i1',
        activityLegacyId: 4,
        selectedDjIds: ['dj-1'],
        eventMeta: 'EDC Thailand',
        days: [],
        conflicts: [],
      },
      {
        type: 'personality_result_ready',
        resultId: 'p1',
        tagline: '派对野兽',
        primaryType: 'rager',
        soulMatchDjName: 'Marshmello',
        result: { version: 1 },
      },
      {
        type: 'activity_registered',
        activityLegacyId: 4,
        title: 'EDC Thailand',
        attendees: 120,
      },
      { type: 'comment_added', postId: 'p1', body: '同路' },
      {
        type: 'client_action',
        action: { kind: 'open_sheet', sheet: 'buddy_post', mode: 'prompt' },
      },
      { type: 'error', message: 'quota' },
    ];

    expect(samples).toHaveLength(STREAM_EVENT_TYPES.length);
    for (const event of samples) {
      expect(STREAM_EVENT_TYPES).toContain(event.type);
    }
  });
});
