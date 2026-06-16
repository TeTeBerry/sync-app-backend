import { inferIntentTagsFromText } from '@src/ai/buddy/infer-intent-tags.util';
import { inferPostContentTypes } from '@src/modules/partner/utils/post-content-type.util';

const TICKET_RESALE_EXAMPLE =
  '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～';

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

  it('infers ticket resale tags from折价出票 post (user example)', () => {
    const tags = inferIntentTagsFromText(TICKET_RESALE_EXAMPLE);
    expect(tags).toEqual(
      expect.arrayContaining([
        '#出票',
        '#折价',
        '#香港',
        '#ASOT',
        '#VIP',
        '#Stage',
        '#6.12',
      ]),
    );
    expect(tags).not.toContain('#其他');
  });

  it('infers ticket content type for折价出票 post (user example)', () => {
    const tags = inferIntentTagsFromText(TICKET_RESALE_EXAMPLE);
    expect(
      inferPostContentTypes({ tags, body: TICKET_RESALE_EXAMPLE }),
    ).toEqual(['ticket']);
  });
});
