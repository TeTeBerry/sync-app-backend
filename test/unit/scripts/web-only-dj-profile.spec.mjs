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
