import {
  normalizeRecruitUnityTags,
  resolveUnityTagsFromSearchText,
} from '@sync/partner-contracts';

describe('recruit-unity-tags', () => {
  it('normalizes valid tags with dedupe and max 3', () => {
    expect(
      normalizeRecruitUnityTags([
        'welcome_newbie',
        'welcome_newbie',
        'women_friendly',
        'multi_day',
        'budget_friendly',
      ]),
    ).toEqual(['welcome_newbie', 'women_friendly', 'multi_day']);
  });

  it('drops invalid tag ids', () => {
    expect(
      normalizeRecruitUnityTags(['welcome_newbie', 'invalid_tag']),
    ).toEqual(['welcome_newbie']);
  });

  it('resolves zh unity tag aliases from search text', () => {
    expect(resolveUnityTagsFromSearchText('欢迎新手')).toEqual([
      'welcome_newbie',
    ]);
  });

  it('resolves en unity tag aliases from search text', () => {
    expect(resolveUnityTagsFromSearchText('women friendly team')).toEqual([
      'women_friendly',
    ]);
  });
});
