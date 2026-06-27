import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildHermesEvidenceFromV4Bundle,
  confidenceToMatchScore,
  shouldApplyV4Bundle,
} from '../../../scripts/lib/apply-v4-pending-landings.mjs';

describe('apply-v4-pending-landings', () => {
  it('maps confidence to match score', () => {
    assert.equal(confidenceToMatchScore('high'), 200);
    assert.equal(confidenceToMatchScore('medium'), 170);
  });

  it('accepts pending_review bundles with discogs id', () => {
    assert.equal(
      shouldApplyV4Bundle(
        {
          decision: 'pending_review',
          confidence: 'high',
          discogs: { id: 48375, name: 'Zany' },
        },
        { minConfidence: 'medium' },
      ),
      true,
    );
    assert.equal(
      shouldApplyV4Bundle(
        {
          decision: 'pending_review',
          confidence: 'low',
          discogs: { id: 1, name: 'X' },
        },
        { minConfidence: 'medium' },
      ),
      false,
    );
  });

  it('builds hermes evidence payload from v4 bundle', () => {
    const evidence = buildHermesEvidenceFromV4Bundle({
      web: [
        {
          source: 'Discogs',
          url: 'https://discogs.com',
          snippet: 'hardstyle',
          relevance: 'high',
        },
      ],
      musicbrainz: { mbid: 'abc', name: 'Zany' },
      sourcedFacts: [{ claim: 'genre', value: 'hardstyle', source: 'Discogs' }],
      integratedReport: '## Zany is a DJ',
    });
    assert.equal(evidence.sourcedFacts.length, 1);
    assert.match(evidence.musicbrainz.url, /musicbrainz/);
    assert.equal(evidence.integratedReport, '## Zany is a DJ');
  });

  it('rejects blocked discogs id for lineup', async () => {
    const { verifyBundleForApply } =
      await import('../../../scripts/lib/apply-v4-pending-landings.mjs');
    const result = await verifyBundleForApply(
      {
        discogs: { id: 1982320, name: 'Anika (9)' },
      },
      'AN!KA',
      { verify: false },
    );
    assert.equal(result.accepted, false);
    assert.match(result.reviewReason ?? '', /Wrong person/i);
  });

  it('rejects no_match without discogs', () => {
    assert.equal(
      shouldApplyV4Bundle(
        {
          decision: 'no_match',
          confidence: 'high',
          discogs: { id: 1, name: 'X' },
        },
        { minConfidence: 'medium' },
      ),
      false,
    );
  });
});
