import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createMusicBrainzClient,
  extractMusicBrainzIdFromUrls,
  isRetryableMbStatus,
  lineupNameMatchesMbArtist,
  normalizeMbNameKey,
  parseDiscogsIdFromUrl,
  parseMusicBrainzIdFromUrl,
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

  it('parses musicbrainz artist id from url', () => {
    const mbid = '886dc0c9-3351-4d2d-b762-060cf1e66929';
    assert.equal(
      parseMusicBrainzIdFromUrl(`https://musicbrainz.org/artist/${mbid}`),
      mbid,
    );
    assert.equal(
      extractMusicBrainzIdFromUrls([
        'https://soundcloud.com/foo',
        `https://musicbrainz.org/artist/${mbid}`,
      ]),
      mbid,
    );
  });

  it('flags retryable MusicBrainz HTTP statuses', () => {
    assert.equal(isRetryableMbStatus(503), true);
    assert.equal(isRetryableMbStatus(429), true);
    assert.equal(isRetryableMbStatus(404), false);
  });
});
