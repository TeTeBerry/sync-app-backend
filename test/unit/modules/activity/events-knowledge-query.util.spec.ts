import { resolveKnowledgeQueryTopics } from '../../../../src/modules/activity/utils/events-knowledge-query.util';

describe('resolveKnowledgeQueryTopics', () => {
  it('prefers travel topics for travel intent', () => {
    expect(
      resolveKnowledgeQueryTopics('韩国签证', { intent: 'travel' }),
    ).toEqual(['travel', 'survival', 'activity']);
  });

  it('detects lineup announce queries', () => {
    expect(
      resolveKnowledgeQueryTopics('storm 什么时候官宣阵容', {
        intent: 'discover',
      }),
    ).toEqual(['lineup_hint', 'activity']);
  });

  it('detects chinese dj alias queries', () => {
    expect(
      resolveKnowledgeQueryTopics('小马丁', { intent: 'discover' }),
    ).toEqual(['dj', 'activity']);
  });
});
