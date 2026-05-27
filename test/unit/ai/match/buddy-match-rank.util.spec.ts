import {
  LIGHT_TIE_BREAK_MAX,
  applyLightTieBreak,
  rankPostsByCriteria,
} from '@src/ai/match/buddy-match-rank.util';
import type { BuddyMatchCriteria } from '@src/ai/match/buddy-match.types';
import type { PostRecord } from '@src/modules/post/interfaces/post.repository.interface';

function post(
  id: string,
  overrides: Partial<PostRecord> = {},
): PostRecord {
  return {
    _id: id,
    userId: `user-${id}`,
    status: 'recruiting',
    activityLegacyId: 4,
    eventTitle: '风暴电音节',
    body: '',
    tags: [],
    ...overrides,
  } as PostRecord;
}

describe('buddy-match-rank.util', () => {
  it('applyLightTieBreak caps boost at LIGHT_TIE_BREAK_MAX', () => {
    const tie = applyLightTieBreak(
      {
        activityLegacyId: 4,
        departureCity: '上海',
        requesterTags: ['拼车', '组队'],
      },
      {
        departureCity: '上海',
        body: '上海出发 #拼车 #组队',
        tags: ['拼车', '组队'],
      },
    );

    expect(tie.boost).toBeLessThanOrEqual(LIGHT_TIE_BREAK_MAX);
    expect(tie.matchReason).toBe('标签契合：#拼车、#组队');
  });

  it('applyLightTieBreak sets city-only match reason', () => {
    const tie = applyLightTieBreak(
      { activityLegacyId: 4, departureCity: '上海' },
      { departureCity: '上海', body: '上海出发' },
    );

    expect(tie.departureCityExact).toBe(true);
    expect(tie.matchReason).toBe('同样从「上海」出发');
  });

  it('rankPostsByCriteria prefers city and tag overlap in Mongo fallback', () => {
    const ranked = rankPostsByCriteria(
      [
        post('remote', {
          departureCity: '北京',
          body: '北京出发找队友',
          tags: ['组队'],
        }),
        post('best', {
          departureCity: '上海',
          body: '上海出发 #拼车 2人女生',
          tags: ['拼车', '组队'],
        }),
      ],
      {
        activityLegacyId: 4,
        departureCity: '上海',
        requesterTags: ['拼车'],
        requesterBody: '上海出发 #拼车',
        intents: ['carpool'],
      },
      2,
    );

    expect(ranked[0]?.postId).toBe('best');
    expect(ranked[0]?.matchReason).toBe('标签契合：#拼车');
  });

  it('ranks Luna-style post above unrelated Guangzhou post for matching requester', () => {
    const ranked = rankPostsByCriteria(
      [
        post('ryan', {
          userId: 'demo-ryan',
          departureCity: '广州',
          location: '广州',
          body: '风暴 STORM 深圳站 6月14日，B区看台，3缺1男生，广州拼车出发，有人吗？',
          tags: ['#组队', '#B区', '#6月14日'],
        }),
        post('luna', {
          userId: 'demo-luna',
          departureCity: '上海',
          location: '上海',
          body: '6月13日场 13号A区 内场票已出，上海出发求拼车到深圳，2人女生，可拼住宿～',
          tags: ['#13号A区', '#拼车', '#拼住宿', '#女生优先'],
        }),
      ],
      {
        activityLegacyId: 4,
        departureCity: '上海',
        requesterTags: ['拼车', '13号a区'],
        requesterBody: '上海出发 #拼车 #13号A区 2人女生',
        intents: ['carpool', 'lodging'],
        genderPref: '女生',
        zone: '13号A区',
      },
      2,
    );

    expect(ranked[0]?.postId).toBe('luna');
    expect(ranked[0]?.matchReason).toContain('标签契合');
    expect(ranked[0]?.matchReason).toContain('#拼车');
  });
});
