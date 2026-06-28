import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectOrphanLineupMapRepairs,
  findMatchingDjForLineup,
  isLineupArtistCovered,
} from '../../../scripts/lib/discogs-crawl.mjs';

describe('orphan lineup map repair', () => {
  const djs = [
    { discogsId: 1, name: 'Tiësto' },
    { discogsId: 2, name: 'Ben Nicky' },
    { discogsId: 3, name: 'RAN-D' },
    { discogsId: 4, name: 'ADARO' },
  ];

  it('finds a solo dj match for lineup name', () => {
    const dj = findMatchingDjForLineup('TIËSTO', djs);
    assert.equal(dj?.discogsId, 1);
    assert.equal(isLineupArtistCovered('TIËSTO', djs), true);
  });

  it('collects orphan repairs for no_map rows with existing djs', () => {
    const { repairs, ambiguous } = collectOrphanLineupMapRepairs({
      missingArtists: [
        { lineupName: 'BEN NICKY', issue: 'no_map' },
        { lineupName: 'UNKNOWN', issue: 'no_map' },
        { lineupName: 'TIËSTO', issue: 'pending_review' },
      ],
      djs,
    });

    assert.equal(repairs.length, 1);
    assert.equal(repairs[0].lineupName, 'BEN NICKY');
    assert.equal(repairs[0].discogsId, 2);
    assert.equal(ambiguous.length, 0);
  });

  it('requires all combo parts to be covered', () => {
    assert.equal(isLineupArtistCovered('RAN-D & ADARO', djs), true);
    assert.equal(isLineupArtistCovered('RAN-D & COONE', djs), false);
  });
});
