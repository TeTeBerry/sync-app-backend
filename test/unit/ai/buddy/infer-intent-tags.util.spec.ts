import { inferIntentTagsFromText } from '@src/ai/buddy/infer-intent-tags.util';

describe('inferIntentTagsFromText', () => {
  it('maps 姐妹 to 女生 and extracts zone from 13A区', () => {
    expect(inferIntentTagsFromText('13A区有姐妹吗')).toEqual(
      expect.arrayContaining(['#女生', '#13号A区', '#A区']),
    );
  });

  it('extracts spaced day-zone labels', () => {
    expect(inferIntentTagsFromText('13 号 A区 缺1人组队')).toEqual(
      expect.arrayContaining(['#13号A区', '#A区', '#组队']),
    );
  });

  it('maps explicit 女生优先', () => {
    expect(inferIntentTagsFromText('限女生 2人')).toContain('#女生优先');
  });

  it('returns empty for unrelated text', () => {
    expect(inferIntentTagsFromText('你好')).toEqual([]);
  });

  it('does not infer ticket tags from VIP zone team posts', () => {
    expect(inferIntentTagsFromText('13号VIP区 缺1人组队 Stage 内场')).toEqual(
      expect.arrayContaining(['#13号', '#组队']),
    );
    expect(
      inferIntentTagsFromText('13号VIP区 缺1人组队 Stage 内场'),
    ).not.toEqual(expect.arrayContaining(['#出票', '#转票', '#VIP', '#Stage']));
  });
});
