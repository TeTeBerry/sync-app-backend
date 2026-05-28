import { extractActivityLookupKeywords } from '@src/ai/buddy/resolve-activity-from-chat.util';

describe('resolve-activity-from-chat.util', () => {
  it('extracts storm festival from buddy post text', () => {
    const keywords = extractActivityLookupKeywords(
      [],
      '风暴电音节 找队友 深圳站 6月13日',
    );
    expect(keywords.some(k => /风暴|storm/i.test(k))).toBe(true);
  });

  it('returns no storm keyword for ASOT Hong Kong ticket resale', () => {
    const keywords = extractActivityLookupKeywords(
      [],
      '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～',
    );
    expect(keywords.some(k => /风暴|storm/i.test(k))).toBe(false);
    expect(keywords.some(k => /asot/i.test(k))).toBe(true);
  });

  it('does not invent keywords for vague home chat', () => {
    const keywords = extractActivityLookupKeywords([], '你好呀 想聊聊天');
    expect(keywords).toEqual([]);
  });
});
