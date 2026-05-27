import {
  buildMatchCriteriaForSearch,
  buildRerankUserNeed,
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
    expect(criteria.excludePostIds).toEqual(['mine']);
  });

  it('buildRerankUserNeed prioritizes requester body and structured fields', () => {
    const need = buildRerankUserNeed({
      activityLegacyId: 4,
      activityName: '风暴电音节',
      departureCity: '上海',
      requesterTags: ['拼车'],
      intents: ['carpool', 'team'],
      zone: '内场',
      eventDate: '2025-05-01',
      genderPref: '女生',
      requesterBody: '上海出发求拼车到深圳，2人女生同行',
    });

    expect(need.startsWith('上海出发求拼车到深圳，2人女生同行')).toBe(true);
    expect(need).toContain('活动：风暴电音节');
    expect(need).toContain('出发地：上海');
    expect(need).toContain('#拼车');
    expect(need).toContain('carpool');
    expect(need).toContain('内场');
    expect(need).toContain('2025-05-01');
    expect(need).toContain('女生');
  });

  it('buildRerankUserNeed truncates very long requester body', () => {
    const longBody = '求'.repeat(900);
    const need = buildRerankUserNeed({
      activityLegacyId: 1,
      requesterBody: longBody,
      departureCity: '北京',
    });

    expect(need.startsWith('求'.repeat(800))).toBe(true);
    expect(need).toContain('出发地：北京');
  });
});
