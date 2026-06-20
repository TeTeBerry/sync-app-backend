import {
  isTravelGuideSheetFastPathInput,
  resolveReadOnlyActivityFastPath,
} from '@src/ai/policy/read-only-fast-path.util';

describe('read-only-fast-path', () => {
  it('matches English travel guide chip without LLM', () => {
    const result = resolveReadOnlyActivityFastPath('Generate travel guide', 4, {
      version: 1,
      flow: 'idle',
    });
    expect(result).toEqual({
      kind: 'dj_info',
      source: 'rule',
      readOnlyFastPath: 'travel_guide_sheet',
    });
  });

  it('matches buddy post chip as create_post rule', () => {
    const result = resolveReadOnlyActivityFastPath('Post buddy thread', 4, {
      version: 1,
      flow: 'idle',
    });
    expect(result).toEqual({ kind: 'create_post', source: 'rule' });
  });

  it('recognizes travel guide sheet labels', () => {
    expect(isTravelGuideSheetFastPathInput('生成出行攻略')).toBe(true);
    expect(isTravelGuideSheetFastPathInput('Generate travel guide')).toBe(true);
  });
});
