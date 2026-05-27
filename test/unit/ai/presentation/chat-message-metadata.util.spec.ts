import { extractAssistantMessageMetadata } from '@src/ai/presentation/chat-message-metadata.util';

describe('extractAssistantMessageMetadata', () => {
  it('collects cards and suggested replies from stream events', () => {
    expect(
      extractAssistantMessageMetadata([
        { type: 'delta', content: 'hello' },
        {
          type: 'post_recommendations',
          posts: [
            {
              postId: 'p1',
              snippet: 'snippet',
              authorName: 'Bob',
              eventTitle: '活动',
            },
          ],
        },
        { type: 'suggested_replies', replies: ['好的'] },
        {
          type: 'post_created',
          postId: 'p2',
          post: {
            postId: 'p2',
            snippet: '已发布',
            authorName: 'Me',
            eventTitle: '活动',
          },
        },
      ]),
    ).toEqual({
      recommendedPosts: [
        {
          postId: 'p1',
          snippet: 'snippet',
          authorName: 'Bob',
          eventTitle: '活动',
        },
      ],
      createdPost: {
        postId: 'p2',
        snippet: '已发布',
        authorName: 'Me',
        eventTitle: '活动',
      },
      suggestedReplies: ['好的'],
    });
  });
});
