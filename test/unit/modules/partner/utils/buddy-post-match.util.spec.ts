import {
  extractBuddyPostMatchSignalsFromRecord,
  pickBestMatchingPostRecord,
  scoreBuddyPostMatch,
} from '@src/modules/partner/utils/buddy-post-match.util';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';

function post(partial: Partial<PostRecord> & { _id: string }): PostRecord {
  return {
    userId: 'u1',
    authorName: 'User',
    body: '',
    tags: [],
    status: 'recruiting',
    ...partial,
  } as PostRecord;
}

describe('buddy-post-match.util', () => {
  const host = post({
    _id: 'host',
    body: '上海出发同路',
    tags: ['同路'],
    contentTypes: ['carpool'],
    departureCity: '上海',
  });

  it('prefers overlapping content types and tags', () => {
    const carpool = extractBuddyPostMatchSignalsFromRecord(
      post({
        _id: 'c1',
        body: '同路',
        tags: ['同路'],
        contentTypes: ['carpool'],
        departureCity: '上海',
      }),
    );
    const team = extractBuddyPostMatchSignalsFromRecord(
      post({ _id: 't1', body: '组队', contentTypes: ['team'] }),
    );
    const hostSignals = extractBuddyPostMatchSignalsFromRecord(host);
    expect(scoreBuddyPostMatch(hostSignals, carpool)).toBeGreaterThan(
      scoreBuddyPostMatch(hostSignals, team),
    );
  });

  it('pickBestMatchingPostRecord returns the highest-scoring post', () => {
    const chosen = pickBestMatchingPostRecord(host, [
      post({ _id: 't1', body: '组队', contentTypes: ['team'] }),
      post({
        _id: 'c1',
        body: '同路同行',
        tags: ['同路'],
        contentTypes: ['carpool'],
        departureCity: '上海',
        createdAt: new Date('2026-01-02'),
      }),
    ]);
    expect(String(chosen?._id)).toBe('c1');
  });
});
