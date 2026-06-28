import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildHermesEvidenceFromV4Bundle,
  confidenceToMatchScore,
  enrichDjRecordFromV4Hermes,
  isV4HermesLandableDjRecord,
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

    const wes = await verifyBundleForApply(
      {
        discogs: { id: 171280, name: 'Partyraiser' },
      },
      'WES S',
      { verify: false },
    );
    assert.equal(wes.accepted, false);
    assert.match(wes.reviewReason ?? '', /Wrong person/i);
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

  it('lands thin discogs rows when v4 hermes has display genres', () => {
    const discogs = {
      isVerifiableDiscogsDjRecord: () => false,
    };
    const enriched = enrichDjRecordFromV4Hermes(
      { profile: '', styles: [], genres: [], representativeWorks: [] },
      { rationale: 'Dutch hardcore DJ with verified festival bookings.' },
      { displayGenres: ['Hardcore'], displayStyles: ['Hardcore'] },
    );
    assert.ok(enriched.styles.includes('Hardcore'));
    assert.ok(enriched.profile.length >= 20);
    assert.equal(
      isV4HermesLandableDjRecord(enriched, discogs, {
        displayGenres: ['Hardcore'],
        displayStyles: ['Hardcore'],
      }),
      true,
    );
  });

  it('lands disambiguation profiles when release styles exist', () => {
    const discogs = {
      isVerifiableDiscogsDjRecord: () => false,
    };
    assert.equal(
      isV4HermesLandableDjRecord(
        {
          profile: 'For the techno artist please use [a=123]',
          styles: ['Techno'],
          representativeWorks: [{ title: 'EP' }],
        },
        discogs,
        {},
      ),
      true,
    );
  });
});
