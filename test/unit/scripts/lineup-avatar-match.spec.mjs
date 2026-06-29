import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bestCatalogMatchScore,
  evaluateAvatarGenreGate,
  isCrossoverGuestProfile,
  normalizeAvatarPersonKey,
  stripDiscogsDisambiguation,
} from '../../../scripts/lib/lineup-avatar-match.mjs';

describe('lineup-avatar-match', () => {
  it('strips Discogs disambiguation suffix', () => {
    assert.equal(stripDiscogsDisambiguation('John Newman (5)'), 'John Newman');
  });

  it('detects crossover guest profiles', () => {
    assert.equal(
      isCrossoverGuestProfile(
        'British soul singer and musician.\r\nBorn 16 June 1990 in Keighley.',
      ),
      true,
    );
    assert.equal(
      isCrossoverGuestProfile(
        'South African drum and bass producer and DJ.',
      ),
      false,
    );
  });

  it('accepts John Newman Soul avatar via crossover corroboration', () => {
    const verdict = evaluateAvatarGenreGate({
      djsStyles: ['House', 'Progressive House'],
      candidateGenres: ['Soul', 'Rock', 'Pop'],
      lineupName: 'John Newman',
      candidateArtistName: 'John Newman',
      discogsName: 'John Newman (5)',
      djProfile:
        'British soul singer and musician.\r\nBorn 16 June 1990 in Keighley.',
      matchScore: 100,
    });
    assert.equal(verdict.accept, true);
    assert.equal(verdict.reason, 'crossover_guest_corroborated');
  });

  it('rejects homonym with partial name score', () => {
    const verdict = evaluateAvatarGenreGate({
      djsStyles: ['Techno'],
      candidateGenres: ['Soul'],
      lineupName: 'MARLO',
      candidateArtistName: 'Marlo Something',
      discogsName: 'Marlo',
      djProfile: 'Techno DJ and producer.',
      matchScore: 80,
    });
    assert.equal(verdict.accept, false);
    assert.equal(verdict.reason, 'genre_mismatch_partial_name');
  });

  it('rejects electronic DJ mapped to vocal homonym', () => {
    const verdict = evaluateAvatarGenreGate({
      djsStyles: ['Drum n Bass'],
      candidateGenres: ['Soul'],
      lineupName: 'MARLO',
      candidateArtistName: 'Marlo',
      discogsName: 'Marlo (2)',
      djProfile: 'Drum and bass producer from South Africa.',
      matchScore: 100,
    });
    assert.equal(verdict.accept, false);
    assert.equal(verdict.reason, 'genre_mismatch_vocal_homonym');
  });

  it('accepts electronic TheAudioDB match without corroboration', () => {
    const verdict = evaluateAvatarGenreGate({
      djsStyles: ['Techno'],
      candidateGenres: ['Electronic', 'Techno'],
      lineupName: 'Charlotte de Witte',
      candidateArtistName: 'Charlotte de Witte',
      discogsName: 'Charlotte de Witte',
      djProfile: 'Belgian techno DJ.',
      matchScore: 100,
    });
    assert.equal(verdict.accept, true);
    assert.equal(verdict.reason, 'electronic_match');
  });

  it('accepts Yellow Claw when TheAudioDB mis-tags Hip-Hop', () => {
    const profile =
      'Yellow Claw is a DJ duo from Amsterdam, Netherlands. Their music is a mix of trap, dubstep, hardstyle.';
    const verdict = evaluateAvatarGenreGate({
      djsStyles: ['Trap', 'Hard Techno', 'Hardstyle'],
      djsGenres: ['Electronic', 'Hip Hop'],
      candidateGenres: ['Hip-Hop'],
      lineupName: 'Yellow Claw',
      candidateArtistName: 'Yellow Claw',
      discogsName: 'Yellow Claw',
      djProfile: profile,
      matchScore: 100,
    });
    assert.equal(verdict.accept, true);
    assert.equal(verdict.reason, 'electronic_dj_corroborated');
  });

  it('accepts Jerrooo billing alias mapped to Jerro with Dance genre', () => {
    const verdict = evaluateAvatarGenreGate({
      djsStyles: ['Progressive House', 'House', 'Tech House'],
      djsGenres: ['Electronic'],
      candidateGenres: ['Dance'],
      lineupName: 'Jerrooo',
      searchName: 'Jerro',
      discogsName: 'Jerro',
      candidateArtistName: 'Jerro',
      djProfile: 'Dj and Producer from Belgium.',
      matchScore: 100,
    });
    assert.equal(verdict.accept, true);
    assert.equal(verdict.reason, 'catalog_alias_electronic_match');
  });

  it('scores alias billing via catalog names', () => {
    assert.equal(
      bestCatalogMatchScore('Jerrooo', 'Jerro', 'Jerro', {
        artistName: 'Jerro',
      }),
      100,
    );
  });

  it('normalizes person keys across sources', () => {
    assert.equal(
      normalizeAvatarPersonKey('John Newman (5)'),
      normalizeAvatarPersonKey('John Newman'),
    );
  });
});
