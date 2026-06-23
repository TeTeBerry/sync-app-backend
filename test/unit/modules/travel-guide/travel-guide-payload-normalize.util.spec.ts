import {
  coerceGuideLine,
  normalizeGuideLines,
  sanitizeLlmTravelGuidePayload,
} from '@src/modules/travel-guide/domain/travel-guide-payload-normalize.util';

describe('travel-guide-payload-normalize', () => {
  it('keeps plain strings', () => {
    expect(normalizeGuideLines(['  高铁抵达  ', '打车前往场馆'])).toEqual([
      '高铁抵达',
      '打车前往场馆',
    ]);
  });

  it('coerces object lines from LLM drift', () => {
    expect(
      normalizeGuideLines([
        { text: '从上海虹桥出发，高铁至深圳北站' },
        { title: '到场', detail: '打车约 40 分钟' },
        '散场建议预约网约车',
      ]),
    ).toEqual([
      '从上海虹桥出发，高铁至深圳北站',
      '到场：打车约 40 分钟',
      '散场建议预约网约车',
    ]);
  });

  it('drops unparseable objects instead of [object Object]', () => {
    expect(coerceGuideLine({ foo: { bar: 1 } })).toBeNull();
    expect(normalizeGuideLines([{ foo: 1 }, '有效文案'])).toEqual(['有效文案']);
  });

  it('sanitizes full LLM payload', () => {
    const out = sanitizeLlmTravelGuidePayload({
      transportLines: [{ content: '路线一' }, { content: '路线二' }],
      hotels: [{ name: '酒店A', note: '¥400/晚' }],
      nightlifeSpots: [{ name: '酒吧B', note: '散场友好' }],
      tipItems: ['提示'],
    } as unknown as import('@src/modules/travel-guide/domain/travel-guide-llm.types').LlmTravelGuidePayload);
    expect(out?.transportLines).toEqual(['路线一', '路线二']);
    expect(out?.hotels[0]?.name).toBe('酒店A');
  });
});
