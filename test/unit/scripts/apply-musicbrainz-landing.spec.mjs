import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMusicBrainzHermesEvidence,
  planMusicBrainzLanding,
} from '../../../scripts/lib/apply-musicbrainz-landing.mjs';
import {
  parseDiscogsIdFromUrl,
} from '../../../scripts/lib/musicbrainz-client.mjs';

describe('apply-musicbrainz-landing', () => {
  it('parses discogs id from MB url-relation', () => {
    assert.equal(
      parseDiscogsIdFromUrl('https://www.discogs.com/artist/682188-Alpha2'),
      682188,
    );
    assert.equal(parseDiscogsIdFromUrl(''), null);
  });

  it('plans discogs landing when MB has discogs url-relation', () => {
    const plan = planMusicBrainzLanding({
      lineupName: 'ALPHA TWINS',
      minMatch: 'strong',
      lookup: {
        matchClass: 'strong_match',
        topDetail: {
          mbid: 'ffbc1fb3-5afa-4993-b721-8c9885644311',
          name: 'Alpha Twins',
          url: 'https://musicbrainz.org/artist/ffbc1fb3-5afa-4993-b721-8c9885644311',
          discogsUrl: 'https://www.discogs.com/artist/682188-Alpha2',
          tags: ['hardstyle'],
        },
      },
    });
    assert.equal(plan.action, 'discogs');
    assert.equal(plan.discogsId, 682188);
  });

  it('plans mb web-only when no discogs but tags exist', () => {
    const plan = planMusicBrainzLanding({
      lineupName: 'DJ Sally',
      minMatch: 'strong',
      lookup: {
        matchClass: 'strong_match',
        topDetail: {
          mbid: 'abc',
          name: 'DJ Sally',
          url: 'https://musicbrainz.org/artist/abc',
          discogsUrl: '',
          tags: ['house', 'techno'],
        },
      },
    });
    assert.equal(plan.action, 'mb_web_only');
  });

  it('skips weak matches by default', () => {
    const plan = planMusicBrainzLanding({
      lineupName: 'CARLOM',
      lookup: {
        matchClass: 'weak_match',
        topDetail: {
          mbid: 'x',
          name: 'Carlo Lio',
          url: 'https://musicbrainz.org/artist/x',
          tags: ['techno'],
        },
      },
    });
    assert.equal(plan.action, 'skip');
  });

  it('builds hermes evidence with sourced facts', () => {
    const evidence = buildMusicBrainzHermesEvidence('DJ Sally', {
      name: 'DJ Sally',
      url: 'https://musicbrainz.org/artist/abc',
      type: 'Person',
      country: 'US',
      tags: ['house'],
      discogsUrl: '',
      aliases: [],
    });
    assert.ok(evidence.musicbrainz?.url.includes('musicbrainz.org'));
    assert.ok(evidence.sourcedFacts.some((row) => row.source === 'MusicBrainz'));
    assert.match(evidence.integratedReport, /DJ Sally/);
  });

  it('includes disambiguation in integrated report', () => {
    const evidence = buildMusicBrainzHermesEvidence('DJ Sally', {
      name: 'DJ SALLY',
      url: 'https://musicbrainz.org/artist/abc',
      type: 'Person',
      disambiguation: 'Chinese Tech House DJ',
      tags: [],
      discogsUrl: '',
      aliases: [],
    });
    assert.match(evidence.integratedReport, /Chinese Tech House DJ/);
    assert.ok(
      evidence.sourcedFacts.some(
        (row) =>
          row.claim === 'Disambiguation' &&
          row.value === 'Chinese Tech House DJ',
      ),
    );
  });
});
