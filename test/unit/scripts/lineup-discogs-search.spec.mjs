import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractLineupDiscogsSearchNames,
  extractMainLineupArtist,
} from '../../../scripts/lib/lineup-discogs-search.mjs';

describe('lineup-discogs-search', () => {
  it('extracts main artist before PRESENTS / FT / dash', () => {
    assert.equal(
      extractMainLineupArtist('JASON PAYNE PRESENTS GOLDSCHOOL'),
      'JASON PAYNE',
    );
    assert.equal(
      extractMainLineupArtist('BEN NICKY PRESENTS XTREME'),
      'BEN NICKY',
    );
    assert.equal(
      extractMainLineupArtist('ABADDON FT. MC RECKLESS'),
      'ABADDON',
    );
    assert.equal(
      extractMainLineupArtist('ARTIST - SUBTITLE SET'),
      'ARTIST',
    );
  });

  it('strips quotes and parentheses from main artist', () => {
    assert.equal(extractMainLineupArtist('GHENGAR (GHASTLY)'), 'GHENGAR');
    assert.equal(
      extractMainLineupArtist('DR. RUDE "JUMP CLASSICS"'),
      'DR. RUDE',
    );
  });

  it('splits collaborators after main-artist extraction', () => {
    assert.deepEqual(
      extractLineupDiscogsSearchNames('ADJUZT & SKG PRESENTS: EEM'),
      ['ADJUZT', 'SKG'],
    );
    assert.deepEqual(
      extractLineupDiscogsSearchNames('MORE KORDS PRESENTS ZAAGPHORIC'),
      ['MORE KORDS'],
    );
  });
});
