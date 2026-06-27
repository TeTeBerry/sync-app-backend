import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allocateSyntheticDiscogsId,
  buildWebOnlyDjRecord,
  isHermesWebOnlyMap,
  isSyntheticDiscogsId,
} from '../../../scripts/lib/web-only-dj-profile.mjs';

describe('web-only-dj-profile', () => {
  it('allocates stable synthetic discogs ids', () => {
    const idA = allocateSyntheticDiscogsId('ZAPRAVKA');
    const idB = allocateSyntheticDiscogsId('ZAPRAVKA');
    const idC = allocateSyntheticDiscogsId('OTHER ARTIST');

    assert.equal(idA, idB);
    assert.notEqual(idA, idC);
    assert.ok(isSyntheticDiscogsId(idA));
    assert.ok(!isSyntheticDiscogsId(5695043));
  });

  it('builds dj record from hermes evidence', () => {
    const record = buildWebOnlyDjRecord({
      lineupName: 'ZAPRAVKA',
      discogsName: 'Zapravka',
      discogsId: 990123456,
      hermesEvidence: {
        integratedReport:
          'Zapravka is a techno DJ from Berlin with RA profile and festival bookings.',
        web: [
          {
            source: 'Resident Advisor',
            url: 'https://ra.co/dj/zapravka',
            snippet: 'Berlin techno DJ',
            relevance: 'high',
          },
        ],
        sourcedFacts: [
          {
            claim: 'genre',
            value: 'Techno, Minimal',
            source: 'Resident Advisor',
          },
        ],
      },
    });

    assert.equal(record.discogsId, 990123456);
    assert.equal(record.name, 'Zapravka');
    assert.ok(record.profile.length >= 20);
    assert.deepEqual(record.genres, ['Techno', 'Minimal']);
    assert.ok(record.urls.includes('https://ra.co/dj/zapravka'));
  });

  it('normalizes Beatport marketing prose in sourced genre facts', () => {
    const record = buildWebOnlyDjRecord({
      lineupName: 'TIGER DRAMA',
      discogsName: 'TIGER DRAMA',
      discogsId: 990222222,
      hermesEvidence: {
        sourcedFacts: [
          {
            claim: 'genre',
            value:
              "mainstage electronic dance music ('explosive synths, driving energy, strong dancefloor impact')",
            source: 'Beatport',
          },
        ],
      },
    });

    assert.deepEqual(record.genres, ['Big Room']);
    assert.deepEqual(record.styles, []);
  });

  it('drops Web/DJ role metadata and keeps parenthetical sub-genres', () => {
    const record = buildWebOnlyDjRecord({
      lineupName: 'MAYSAA',
      discogsName: 'MAYSAA',
      discogsId: 990333333,
      hermesEvidence: {
        sourcedFacts: [
          { claim: 'genre', value: 'Web', source: 'Web' },
        ],
      },
    });
    assert.deepEqual(record.genres, []);

    const pixzy = buildWebOnlyDjRecord({
      lineupName: 'PIXZY',
      discogsName: 'PIXZY',
      discogsId: 990444444,
      hermesEvidence: {
        sourcedFacts: [
          {
            claim: 'genre',
            value: 'Electronic (bass music · future bass · bass house · EDM)',
            source: 'Web',
          },
        ],
      },
    });
    assert.ok(pixzy.genres.includes('future bass'));
    assert.ok(pixzy.genres.includes('bass house'));
    assert.equal(pixzy.genres.includes('Web'), false);
  });

  it('detects hermes web-only map rows', () => {
    assert.ok(
      isHermesWebOnlyMap({
        status: 'mapped',
        source: 'hermes-v4-web',
        discogsId: 990111111,
      }),
    );
    assert.ok(
      !isHermesWebOnlyMap({
        status: 'mapped',
        source: 'hermes-v4',
        discogsId: 42,
      }),
    );
  });
});
