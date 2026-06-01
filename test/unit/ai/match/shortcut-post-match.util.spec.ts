import {
  intentsForShortcutTag,
  postMatchesShortcutTag,
} from '@src/ai/match/shortcut-post-match.util';

describe('shortcut-post-match.util', () => {
  it('maps 拼卡 to carpool intent', () => {
    expect(intentsForShortcutTag('拼卡')).toEqual(['carpool']);
    expect(intentsForShortcutTag('拼车')).toEqual(['carpool']);
  });

  it('matches carpool posts for 拼卡 shortcut', () => {
    expect(
      postMatchesShortcutTag(
        {
          body: '上海出发求拼车到深圳，2人女生',
          tags: ['#拼车'],
        },
        '拼卡',
      ),
    ).toBe(true);

    expect(
      postMatchesShortcutTag(
        {
          body: '只找拼房女生',
          tags: ['#拼住宿'],
        },
        '拼卡',
      ),
    ).toBe(false);
  });
});
