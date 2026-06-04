import {
  resolveOwnerRecruitingPostForMatch,
  syntheticPostRecordFromShortcut,
} from '@src/ai/match/resolve-owner-post-for-match.util';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';

describe('resolve-owner-post-for-match.util', () => {
  const carpoolPost = {
    _id: 'carpool',
    userId: 'me',
    body: '上海出发求同路到会场',
    tags: ['同路'],
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

  it('picks carpool recruiting post when shortcut is 找同路伙伴', () => {
    const picked = resolveOwnerRecruitingPostForMatch(
      [teamPost, carpoolPost],
      '找同路伙伴',
    );
    expect(String(picked?._id)).toBe('carpool');
  });

  it('picks team recruiting post when shortcut is 找组队', () => {
    const picked = resolveOwnerRecruitingPostForMatch(
      [carpoolPost, teamPost],
      '组队队友',
    );
    expect(String(picked?._id)).toBe('team');
  });

  it('returns the only recruiting post without scoring', () => {
    expect(resolveOwnerRecruitingPostForMatch([teamPost], '找同路伙伴')).toBe(
      teamPost,
    );
  });

  it('builds synthetic shortcut target with carpool signals', () => {
    const synthetic = syntheticPostRecordFromShortcut('找同路伙伴');
    expect(synthetic.contentTypes).toContain('carpool');
    expect(synthetic.body).toMatch(/同路/);
  });
});
