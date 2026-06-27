import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isDuoBillingLineupName,
  isSoloLineupMappedToDuoDiscogs,
  resolveAvatarSearchName,
  shouldSkipV4BundleForLineup,
} from '../../../scripts/lib/lineup-billing-guards.mjs';
import { expandRealSoloArtistTargets } from '../../../scripts/lib/lineup-real-artist-catalog.mjs';

describe('lineup-billing-guards', () => {
  it('detects duo billing names', () => {
    assert.equal(isDuoBillingLineupName('YOJI BIOMEHANIKA & SCOT PROJECT'), true);
    assert.equal(isDuoBillingLineupName('LARSTIG'), false);
  });

  it('flags solo lineup mapped to duo discogs', () => {
    assert.equal(
      isSoloLineupMappedToDuoDiscogs(
        'LARSTIG',
        "Altijd Larstig & Rob Gasd'rop",
      ),
      true,
    );
    assert.equal(
      isSoloLineupMappedToDuoDiscogs(
        'LARSTIG & GASDROP',
        "Altijd Larstig & Rob Gasd'rop",
      ),
      false,
    );
  });

  it('prefers lineup name for avatar search when discogs is duo', () => {
    assert.equal(
      resolveAvatarSearchName('LARSTIG', "Altijd Larstig & Rob Gasd'rop"),
      'LARSTIG',
    );
    assert.equal(resolveAvatarSearchName('ZANY', 'Zany'), 'Zany');
  });

  it('skips v4 apply for combo bundle expanded to solo', () => {
    const guard = shouldSkipV4BundleForLineup({
      lineupName: 'SCOT PROJECT',
      matchedVia: 'expanded_from_display',
      sourceDisplay: 'YOJI BIOMEHANIKA & SCOT PROJECT',
      discogsName: 'Yoji Biomehanika',
      expandRealSoloArtistTargets,
    });
    assert.equal(guard.skip, true);
    assert.equal(guard.reason, 'combo_bundle_expanded_to_solo');
  });

  it('skips v4 apply when discogs is duo for solo lineup', () => {
    const guard = shouldSkipV4BundleForLineup({
      lineupName: 'LARSTIG',
      matchedVia: 'exact',
      sourceDisplay: null,
      discogsName: "Altijd Larstig & Rob Gasd'rop",
      expandRealSoloArtistTargets,
    });
    assert.equal(guard.skip, true);
    assert.equal(guard.reason, 'solo_lineup_duo_discogs');
  });

  it('finds misapplied combo spread maps', async () => {
    const { findMisappliedHermesV4Maps } = await import(
      '../../../scripts/lib/lineup-billing-guards.mjs'
    );
    const purge = findMisappliedHermesV4Maps([
      {
        lineupName: 'SCOT PROJECT',
        lineupNameKey: 'scot project',
        discogsId: 39204,
        discogsName: 'Yoji Biomehanika',
        source: 'hermes-v4-apply',
      },
      {
        lineupName: 'YOJI BIOMEHANIKA',
        lineupNameKey: 'yoji biomehanika',
        discogsId: 39204,
        discogsName: 'Yoji Biomehanika',
        source: 'hermes-v4-apply',
      },
      {
        lineupName: 'LARSTIG',
        lineupNameKey: 'larstig',
        discogsId: 8021237,
        discogsName: "Altijd Larstig & Rob Gasd'rop",
        source: 'hermes-v4-apply',
      },
    ]);
    const names = purge.map((row) => row.lineupName).sort();
    assert.deepEqual(names, ['LARSTIG', 'SCOT PROJECT']);
  });
});
