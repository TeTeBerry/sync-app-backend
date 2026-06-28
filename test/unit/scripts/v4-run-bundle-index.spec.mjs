import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findV4BundleForLineupName } from '../../../scripts/lib/v4-run-bundle-index.mjs';

describe('v4-run-bundle-index', () => {
  const bundles = [
    {
      lineupName: 'ZANY',
      decision: 'pending_review',
      confidence: 'high',
      discogs: { id: 48375, name: 'Zany', profile: 'Dutch hardstyle DJ.' },
    },
    {
      lineupName: 'WES S & $AVVY',
      decision: 'pending_review',
      confidence: 'low',
      discogs: { id: 111, name: 'Wes S' },
    },
  ];

  const index = {
    runId: 'test-run',
    finishedAt: '2026-06-27T00:00:00.000Z',
    bundles,
    bundleByUpper: new Map(
      bundles.map((bundle) => [bundle.lineupName.toUpperCase(), bundle]),
    ),
  };

  it('indexes bundles by lineup name', () => {
    const exact = findV4BundleForLineupName('ZANY', index);
    assert.equal(exact.bundle?.discogs?.id, 48375);
    assert.equal(exact.matchedVia, 'exact');

    const expanded = findV4BundleForLineupName('$AVVY', index);
    assert.equal(expanded.bundle?.lineupName, 'WES S & $AVVY');
    assert.equal(expanded.matchedVia, 'expanded_from_display');
  });
});
