import {
  buildMatchCriteriaForSearch,
  criteriaFromPostRecord,
  inferDepartureCityFromText,
} from '@src/ai/match/buddy-match-criteria.util';
import type { PostRecord } from '@src/modules/post/interfaces/post.repository.interface';

describe('buddy-match-criteria.util', () => {
  it('extracts departure city from post body', () => {
    expect(
      inferDepartureCityFromText('帮我组队 同行，2人同行，从 上海 出发'),
    ).toBe('上海');
  });

  it('builds criteria from stored post fields', () => {
    const post = {
      _id: 'p1',
      userId: 'u2',
      body: '上海出发求拼车',
      departureCity: '上海',
      activityLegacyId: 4,
      eventTitle: '风暴电音节',
      status: 'recruiting',
    } as PostRecord;

    const criteria = criteriaFromPostRecord(post, { name: '风暴', code: 'storm' });
    expect(criteria.departureCity).toBe('上海');
    expect(criteria.activityLegacyId).toBe(4);
  });

  it('merges owner post departure into search criteria', () => {
    const ownerPost = {
      _id: 'mine',
      userId: 'me',
      body: '从 上海 出发，2人同行',
      departureCity: '上海',
      activityLegacyId: 4,
      status: 'recruiting',
    } as PostRecord;

    const criteria = buildMatchCriteriaForSearch({
      activityLegacyId: 4,
      activityName: '风暴电音节',
      ownerPost,
      userInput: '组队队友',
    });

    expect(criteria.departureCity).toBe('上海');
  });
});
