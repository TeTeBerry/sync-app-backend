import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  inferCatalogGenresFromArtistContext,
  needsStyleInference,
} from '../../../scripts/lib/infer-dj-styles-from-profile.mjs';

describe('infer-dj-styles-from-profile', () => {
  it('detects artists missing specific styles', () => {
    assert.equal(
      needsStyleInference(
        { profile: 'Techno DJ', genres: [], styles: [] },
        { displayGenres: [], displayStyles: [] },
      ),
      true,
    );
    assert.equal(
      needsStyleInference(
        { profile: 'Bio', genres: ['Techno'], styles: ['Techno'] },
        { displayGenres: [], displayStyles: [] },
      ),
      false,
    );
    assert.equal(
      needsStyleInference(
        { profile: 'Bio', genres: ['Electronic'], styles: [] },
        { displayGenres: [], displayStyles: [] },
      ),
      true,
    );
  });

  it('infers genres from natural-language profile text', () => {
    const inferred = inferCatalogGenresFromArtistContext({
      profileText: 'WREX is a house DJ from the UK with regular club bookings.',
    });

    assert.ok(inferred.genres.includes('House'));
    assert.deepEqual(inferred.styles, inferred.genres);
  });

  it('prefers hermes sourced facts over generic profile prose', () => {
    const inferred = inferCatalogGenresFromArtistContext({
      hermesEvidence: {
        sourcedFacts: [{ claim: 'genre', value: 'Hard Techno', source: 'RA' }],
        integratedReport: 'Festival DJ with high energy mainstage sets.',
      },
      profileText: 'Festival DJ with high energy mainstage sets.',
    });

    assert.ok(inferred.genres.includes('Hard Techno'));
  });

  it('extracts sub-genres from parenthetical hermes prose', () => {
    const inferred = inferCatalogGenresFromArtistContext({
      hermesEvidence: {
        sourcedFacts: [
          {
            claim: 'genre',
            value: 'Electronic (bass music · future bass · bass house · EDM)',
            source: 'Web',
          },
        ],
      },
      profileText: 'Electronic DJ billed at regional festivals.',
    });

    assert.ok(inferred.genres.includes('future bass'));
    assert.ok(inferred.genres.includes('bass house'));
  });

  it('returns empty when profile has no genre lexicon signal', () => {
    const inferred = inferCatalogGenresFromArtistContext({
      profileText:
        '33 BELOW 结论: mapped · 置信度 high 来源明细 | 信息项 | 内容 | 来源',
    });

    assert.deepEqual(inferred.genres, []);
  });
});
