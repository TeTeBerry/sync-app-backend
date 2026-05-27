import {
  buildMatchCriteriaForSearch,
  buildRerankUserNeed,
  criteriaFromPostRecord,
  inferDepartureCityFromText,
  inferIntentsFromPost,
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

  describe('inferIntentsFromPost', () => {
    it('detects carpool intent', () => {
      expect(inferIntentsFromPost([], '上海出发求拼车')).toContain('carpool');
      expect(inferIntentsFromPost([], '顺风车有无')).toContain('carpool');
    });

    it('detects lodging intent', () => {
      expect(inferIntentsFromPost([], '求拼房')).toContain('lodging');
      expect(inferIntentsFromPost([], '一起拼住宿')).toContain('lodging');
    });

    it('detects ticket intent', () => {
      expect(inferIntentsFromPost([], '13号A区内场票')).toContain('ticket');
    });

    it('detects food intent', () => {
      expect(inferIntentsFromPost([], '有没有人晚上一起宵夜的')).toContain('food');
      expect(inferIntentsFromPost([], '求夜宵搭子')).toContain('food');
      expect(inferIntentsFromPost([], '一起聚餐吃火锅')).toContain('food');
      expect(inferIntentsFromPost([], '想找人吃烧烤')).toContain('food');
      expect(inferIntentsFromPost([], '美食探店')).toContain('food');
    });

    it('detects social intent', () => {
      expect(inferIntentsFromPost([], '喝酒组队')).toContain('social');
      expect(inferIntentsFromPost([], 'afterparty一起')).toContain('social');
      expect(inferIntentsFromPost([], '蹦迪搭子')).toContain('social');
      expect(inferIntentsFromPost([], '酒局缺人')).toContain('social');
      expect(inferIntentsFromPost([], '酒吧微醺')).toContain('social');
      expect(inferIntentsFromPost([], '找ap')).toContain('social');
      expect(inferIntentsFromPost([], 'ap一起')).toContain('social');
      expect(inferIntentsFromPost([], '#ap')).toContain('social');
    });

    it('does not mis-detect social intent in unrelated words', () => {
      expect(inferIntentsFromPost([], 'apple')).not.toContain('social');
      expect(inferIntentsFromPost([], 'api')).not.toContain('social');
      expect(inferIntentsFromPost([], 'map')).not.toContain('social');
    });

    it('falls back to team when no specific intent matched', () => {
      expect(inferIntentsFromPost([], '随便逛逛')).toEqual(['team']);
      expect(inferIntentsFromPost([], '')).toEqual(['team']);
    });

    it('allows multiple intents', () => {
      const intents = inferIntentsFromPost([], '求拼车拼房');
      expect(intents).toContain('carpool');
      expect(intents).toContain('lodging');
    });
  });
});
