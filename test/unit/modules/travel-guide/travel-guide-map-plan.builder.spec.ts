import { mergeRankedHotelsWithLlmPolish } from '../../../../src/modules/travel-guide/map/travel-guide-map-plan.builder';

describe('mergeRankedHotelsWithLlmPolish', () => {
  it('keeps ranked hotel order and names while applying LLM note polish', () => {
    const ranked = [
      { name: '酒店A', note: '¥150-250/晚', bookingHint: '携程' },
      { name: '酒店B', note: '¥250-300/晚' },
    ];
    const llm = [
      { name: '酒店B', note: '润色后的 B 文案' },
      { name: '酒店A', note: '润色后的 A 文案' },
      { name: '编造酒店', note: '不应出现' },
    ];

    const merged = mergeRankedHotelsWithLlmPolish(ranked, llm);
    expect(merged.map((h) => h.name)).toEqual(['酒店A', '酒店B']);
    expect(merged[0]?.note).toBe('润色后的 A 文案');
    expect(merged[1]?.note).toBe('润色后的 B 文案');
  });
});
