import {
  isLineupOverviewFastPathInput,
  isScheduleOverviewFastPathInput,
  resolveReadOnlyActivityFastPath,
  shouldBypassAgentForReadOnlyFastPath,
} from '@src/ai/policy/read-only-fast-path.util';

describe('read-only-fast-path.util', () => {
  const idleState = { version: 1 as const, flow: 'idle' as const };

  it('detects lineup chip labels', () => {
    expect(isLineupOverviewFastPathInput('查阵容')).toBe(true);
    expect(isLineupOverviewFastPathInput('阵容')).toBe(true);
    expect(isLineupOverviewFastPathInput('Marshmello 是什么风格')).toBe(false);
  });

  it('detects schedule chip labels', () => {
    expect(isScheduleOverviewFastPathInput('查演出表')).toBe(true);
    expect(isScheduleOverviewFastPathInput('演出表')).toBe(true);
    expect(isScheduleOverviewFastPathInput('查阵容')).toBe(false);
  });

  it('resolves lineup fast path when activity is bound', () => {
    expect(resolveReadOnlyActivityFastPath('查阵容', 1, idleState)).toEqual({
      kind: 'dj_info',
      source: 'rule',
      readOnlyFastPath: 'lineup',
    });
  });

  it('resolves travel guide sheet fast path', () => {
    expect(
      resolveReadOnlyActivityFastPath('生成出行攻略', 1, idleState),
    ).toEqual({
      kind: 'dj_info',
      source: 'rule',
      readOnlyFastPath: 'travel_guide_sheet',
    });
  });

  it('resolves schedule fast path when activity is bound', () => {
    expect(resolveReadOnlyActivityFastPath('查演出表', 1, idleState)).toEqual({
      kind: 'dj_info',
      source: 'rule',
      readOnlyFastPath: 'schedule',
    });
  });

  it('skips fast path during active travel guide collection', () => {
    expect(
      resolveReadOnlyActivityFastPath('查阵容', 1, {
        version: 1,
        flow: 'idle',
        activeTask: {
          kind: 'travel_guide',
          travelGuide: { departure: '上海' },
        },
      }),
    ).toBeNull();
  });

  it('bypasses agent when readOnlyFastPath is set', () => {
    expect(
      shouldBypassAgentForReadOnlyFastPath({
        kind: 'dj_info',
        source: 'rule',
        readOnlyFastPath: 'lineup',
      }),
    ).toBe(true);
    expect(
      shouldBypassAgentForReadOnlyFastPath({
        kind: 'dj_info',
        source: 'llm',
      }),
    ).toBe(false);
  });
});
