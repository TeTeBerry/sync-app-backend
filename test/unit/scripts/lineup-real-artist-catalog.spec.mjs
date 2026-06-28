import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectRealSoloArtistTargets,
  expandRealSoloArtistTargets,
  getLineupVerifyNameVariants,
  hasMappedRealArtistData,
  isBillingLineupDisplayName,
  isLineupNonArtistLabel,
  normalizeLineupArtistNameForMatch,
} from '../../../scripts/lib/lineup-real-artist-catalog.mjs';

describe('lineup-real-artist-catalog', () => {
  it('filters stage and contest labels', () => {
    assert.equal(isLineupNonArtistLabel('DEFQON.1 LEGENDS'), true);
    assert.equal(isLineupNonArtistLabel('ROAD TO WELCOME STAGE'), true);
    assert.equal(isLineupNonArtistLabel('HARDER CLASS HARDSTYLE CONTEST'), true);
    assert.equal(isLineupNonArtistLabel('THE ENDSHOW'), true);
    assert.equal(isLineupNonArtistLabel('COONE'), false);
    assert.equal(isLineupNonArtistLabel('TIËSTO'), false);
  });

  it('expands combo billing into solo artists', () => {
    const ranD = expandRealSoloArtistTargets('RAN-D & ADARO');
    assert.ok(ranD.includes('RAN-D'));
    assert.ok(ranD.includes('ADARO'));

    const wes = expandRealSoloArtistTargets('WES S & $AVVY');
    assert.ok(wes.includes('WES S'));
    assert.ok(wes.includes('$AVVY'));
  });

  it('strips set titles and keeps the solo artist', () => {
    assert.deepEqual(expandRealSoloArtistTargets('DR. RUDE "JUMP CLASSICS"'), [
      'DR. RUDE',
    ]);
    assert.deepEqual(expandRealSoloArtistTargets('GECK-O "THE SOUL SHAKER"'), [
      'GECK-O',
    ]);
    assert.equal(
      normalizeLineupArtistNameForMatch('THAROZA - LIVE OR DIE'),
      'THAROZA',
    );
    assert.equal(
      normalizeLineupArtistNameForMatch('EZG - MAXIMAAL!'),
      'EZG',
    );
    assert.deepEqual(expandRealSoloArtistTargets('SHOWTEK HARDSTYLE SET'), [
      'SHOWTEK',
    ]);
    assert.deepEqual(expandRealSoloArtistTargets('KRISTA BOURGEOIS LIVE'), [
      'KRISTA BOURGEOIS',
    ]);
  });

  it('flags billing display names for split / v4 shunt', () => {
    assert.equal(isBillingLineupDisplayName('RAN-D & ADARO'), true);
    assert.equal(isBillingLineupDisplayName('EZG - MAXIMAAL!'), true);
    assert.equal(isBillingLineupDisplayName('SHOWTEK HARDSTYLE SET'), true);
    assert.equal(isBillingLineupDisplayName('COONE'), false);
    assert.equal(isBillingLineupDisplayName('DEFQON.1 LEGENDS'), false);
  });

  it('builds verify variants from stripped billing and aliases', () => {
    const tharoza = getLineupVerifyNameVariants('THAROZA - LIVE OR DIE');
    assert.ok(tharoza.includes('THAROZA'));

    const party = getLineupVerifyNameVariants('PARTYRASER');
    assert.ok(party.includes('Partyraiser'));

    const scot = getLineupVerifyNameVariants('SCOT PROJECT');
    assert.ok(scot.includes('DJ Scot Project'));

    const me = getLineupVerifyNameVariants('ME');
    assert.ok(me.includes('&Me'));

    const purple = getLineupVerifyNameVariants('PURPLE RABBIT');
    assert.ok(purple.includes('DJ Purple Rabbit'));

    const firaga = getLineupVerifyNameVariants('Firaga');
    assert.ok(firaga.includes('Dj Firaga'));
  });

  it('splits comma-separated artist lists from billing rows', () => {
    const parts = expandRealSoloArtistTargets(
      'FACELESS, SANCTUARY & DARK ENTITIES',
    );
    assert.ok(parts.includes('FACELESS'));
    assert.ok(parts.includes('SANCTUARY'));
    assert.ok(parts.includes('DARK ENTITIES'));
  });

  it('dedupes real solo targets across display names', () => {
    const targets = collectRealSoloArtistTargets([
      'RAN-D & ADARO',
      'RAN-D',
      'DEFQON.1 LEGENDS',
    ]);
    assert.ok(targets.includes('RAN-D'));
    assert.ok(targets.includes('ADARO'));
    assert.equal(targets.includes('DEFQON.1 LEGENDS'), false);
  });

  it('treats manual-stub as missing real mapped data', () => {
    assert.equal(
      hasMappedRealArtistData(
        {
          status: 'mapped',
          discogsId: 1,
          source: 'manual-stub',
        },
        { genres: ['Techno'], profile: 'stub' },
      ),
      false,
    );
  });

  it('accepts mapped rows with display genres', () => {
    assert.equal(
      hasMappedRealArtistData(
        {
          status: 'mapped',
          discogsId: 1,
          source: 'festival-crawl',
          displayGenres: ['Hardstyle'],
        },
        null,
      ),
      true,
    );
  });
});
