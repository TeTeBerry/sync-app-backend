import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickMbArtistHitForLineup } from '../../../scripts/lib/musicbrainz-artist-resolve.mjs';

describe('musicbrainz-artist-resolve', () => {
  it('prefers curated MB artist for DJ SALLY over Las Vegas homonym', () => {
    const hits = [
      {
        id: 'a1b332ba-592a-45df-bf12-b3f0e3c98fd4',
        name: 'DJ Sally',
        score: 100,
      },
      {
        id: '125f75fd-e2a9-4978-8099-02d9646fe1dd',
        name: 'DJ SALLY (Chinese Tech House DJ)',
        score: 92,
      },
    ];

    const picked = pickMbArtistHitForLineup('DJ Sally', hits);
    assert.equal(picked?.id, '125f75fd-e2a9-4978-8099-02d9646fe1dd');
  });

  it('rejects blocked MBIDs for lineup', () => {
    const hits = [
      {
        id: 'a1b332ba-592a-45df-bf12-b3f0e3c98fd4',
        name: 'DJ Sally',
        score: 100,
      },
    ];

    const picked = pickMbArtistHitForLineup('DJ SALLY', hits);
    assert.equal(picked, null);
  });
});
