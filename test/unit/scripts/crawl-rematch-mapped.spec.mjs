import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveRematchMappedPlan } from '../../../scripts/lib/discogs-crawl.mjs';

describe('resolveRematchMappedPlan', () => {
  it('scopes rematch to explicit names only', () => {
    const plan = resolveRematchMappedPlan({
      mappedLineupNames: ['TIËSTO', 'MARTIN GARRIX', 'RAN-D & ADARO'],
      explicitNames: ['SLOTH'],
    });

    assert.deepEqual(plan.targets, ['SLOTH']);
    assert.deepEqual(plan.toClear, ['SLOTH']);
    assert.equal(plan.scopedToExplicitNames, true);
    assert.equal(plan.mappedRowCount, 3);
  });

  it('rematches full mapped catalog when no explicit names', () => {
    const plan = resolveRematchMappedPlan({
      mappedLineupNames: ['RAN-D & ADARO', 'COONE'],
      explicitNames: null,
    });

    assert.ok(plan.targets.includes('RAN-D'));
    assert.ok(plan.targets.includes('ADARO'));
    assert.ok(plan.targets.includes('COONE'));
    assert.ok(plan.toClear.includes('RAN-D & ADARO'));
    assert.equal(plan.scopedToExplicitNames, false);
  });

  it('expands multiple explicit names', () => {
    const plan = resolveRematchMappedPlan({
      mappedLineupNames: ['A', 'B', 'C'],
      explicitNames: ['SLOTH', 'FLAMMAN'],
    });

    assert.deepEqual(plan.targets, ['SLOTH', 'FLAMMAN']);
    assert.deepEqual(plan.toClear, ['SLOTH', 'FLAMMAN']);
  });
});
