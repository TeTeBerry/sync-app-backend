import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectArtistsMissingProfileText,
  collectRealSoloArtistTargets,
  expandRealSoloArtistTargets,
  filterCrawlableLineupNames,
  getLineupVerifyNameVariants,
  hasCatalogProfileText,
  hasPersistedDjProfile,
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

  it('flags empty_profile when mapped with genres but no bio', () => {
    const mapRow = {
      status: 'mapped',
      discogsId: 42,
      source: 'festival-crawl',
      displayGenres: ['Techno'],
    };
    const dj = { discogsId: 42, genres: ['Techno'], profile: '' };

    assert.equal(hasMappedRealArtistData(mapRow, dj), true);
    assert.equal(hasCatalogProfileText(mapRow, dj), false);

    const missing = collectArtistsMissingProfileText({
      displayNames: ['COONE'],
      mapByKey: new Map([['coone', mapRow]]),
      djById: new Map([[42, dj]]),
    });
    assert.equal(missing.length, 1);
    assert.equal(missing[0].issue, 'empty_profile');
  });

  it('still flags missing when only hermes report is on map', () => {
    const mapRow = {
      status: 'mapped',
      discogsId: 7,
      source: 'festival-crawl',
      displayGenres: ['Hardstyle'],
      hermesEvidence: {
        integratedReport: 'COONE is a Belgian hardstyle DJ.',
      },
    };
    const dj = { discogsId: 7, genres: ['Hardstyle'], profile: '' };

    assert.equal(hasCatalogProfileText(mapRow, dj), true);
    assert.equal(hasPersistedDjProfile(dj), false);
    const missing = collectArtistsMissingProfileText({
      displayNames: ['COONE'],
      mapByKey: new Map([['coone', mapRow]]),
      djById: new Map([[7, dj]]),
    });
    assert.equal(missing.length, 1);
    assert.equal(missing[0].issue, 'empty_profile');
  });

  it('skips artists once djs.profile is persisted', () => {
    const mapRow = {
      status: 'mapped',
      discogsId: 7,
      source: 'hermes-v4',
      displayGenres: ['Hardstyle'],
      hermesEvidence: {
        integratedReport: 'COONE is a Belgian hardstyle DJ.',
      },
    };
    const dj = {
      discogsId: 7,
      genres: ['Hardstyle'],
      profile: 'COONE is a Belgian hardstyle DJ.',
    };

    assert.equal(hasPersistedDjProfile(dj), true);
    const missing = collectArtistsMissingProfileText({
      displayNames: ['COONE'],
      mapByKey: new Map([['coone', mapRow]]),
      djById: new Map([[7, dj]]),
    });
    assert.equal(missing.length, 0);
  });

  it('filterCrawlableLineupNames drops stage labels', () => {
    const filtered = filterCrawlableLineupNames([
      'COONE',
      'DEFQON.1 LEGENDS',
      'THE ENDSHOW',
    ]);
    assert.deepEqual(filtered, ['COONE']);
  });
});
