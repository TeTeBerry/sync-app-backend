import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createMusicBrainzClient,
  isRetryableMbStatus,
  lineupNameMatchesMbArtist,
  normalizeMbNameKey,
  parseDiscogsIdFromUrl,
} from '../../../scripts/lib/musicbrainz-client.mjs';

describe('musicbrainz-client', () => {
  it('normalizes names for comparison', () => {
    assert.equal(normalizeMbNameKey('DJ Sally'), 'djsally');
    assert.equal(normalizeMbNameKey('Kölsch'), 'kolsch');
  });

  it('matches lineup against artist aliases', () => {
    assert.equal(
      lineupNameMatchesMbArtist('ALPHA TWINS', {
        name: 'Alpha²',
        aliases: [{ name: 'Alpha Twins' }],
      }),
      true,
    );
    assert.equal(
      lineupNameMatchesMbArtist('CARLOM', {
        name: 'Carlo Lio',
        aliases: [],
      }),
      false,
    );
  });

  it('builds lucene artist query', () => {
    const mb = createMusicBrainzClient();
    assert.equal(
      mb.buildArtistQuery('DJ Sally'),
      'artist:"DJ Sally" OR alias:"DJ Sally"',
    );
  });

  it('parses discogs artist id from url', () => {
    assert.equal(parseDiscogsIdFromUrl('https://www.discogs.com/artist/123'), 123);
  });

  it('flags retryable MusicBrainz HTTP statuses', () => {
    assert.equal(isRetryableMbStatus(503), true);
    assert.equal(isRetryableMbStatus(429), true);
    assert.equal(isRetryableMbStatus(404), false);
  });
});
