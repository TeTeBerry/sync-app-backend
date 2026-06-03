import {
  resolveOwnerRecruitingPostForMatch,
  syntheticPostRecordFromShortcut,
} from '@src/ai/match/resolve-owner-post-for-match.util';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';

describe('resolve-owner-post-for-match.util', () => {
  const carpoolPost = {
    _id: 'carpool',
    userId: 'me',
    body: '上海出发求拼车到会场',
    tags: ['拼车'],
    contentTypes: ['carpool'],
    status: 'recruiting',
    createdAt: new Date('2025-01-02'),
  } as PostRecord;

  const teamPost = {
    _id: 'team',
    userId: 'me',
    body: '缺2人组队同行',
    tags: ['组队'],
    contentTypes: ['team'],
    status: 'recruiting',
    createdAt: new Date('2025-01-03'),
  } as PostRecord;

  it('picks carpool recruiting post when shortcut is 找拼车', () => {
    const picked = resolveOwnerRecruitingPostForMatch(
      [teamPost, carpoolPost],
      '找拼车',
    );
    expect(String(picked?._id)).toBe('carpool');
  });

  it('picks team recruiting post when shortcut is 找队友', () => {
    const picked = resolveOwnerRecruitingPostForMatch(
      [carpoolPost, teamPost],
      '组队队友',
    );
    expect(String(picked?._id)).toBe('team');
  });

  it('returns the only recruiting post without scoring', () => {
    expect(resolveOwnerRecruitingPostForMatch([teamPost], '找拼车')).toBe(
      teamPost,
    );
  });

  it('builds synthetic shortcut target with carpool signals', () => {
    const synthetic = syntheticPostRecordFromShortcut('找拼车');
    expect(synthetic.contentTypes).toContain('carpool');
    expect(synthetic.body).toMatch(/拼车/);
  });
});
