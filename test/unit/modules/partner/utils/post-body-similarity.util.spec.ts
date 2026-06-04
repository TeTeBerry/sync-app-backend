import {
  arePostBodiesSimilar,
  normalizePostBodyForComparison,
} from '@src/modules/partner/utils/post-body-similarity.util';

describe('post-body-similarity.util', () => {
  it('normalizes punctuation and whitespace', () => {
    expect(normalizePostBodyForComparison('找组队，6.13-6.14，上海，1人')).toBe(
      normalizePostBodyForComparison('找组队 6.13-6.14 上海 1人'),
    );
  });

  it('treats near-identical recruiting copy as similar', () => {
    expect(
      arePostBodiesSimilar(
        '找组队，6.13-6.14，上海，1人',
        '找组队，6.13-6.14，上海，1人',
      ),
    ).toBe(true);

    expect(
      arePostBodiesSimilar(
        '找组队，6.13-6.14，上海，1人',
        '找组队 6.13-6.14 上海 1人',
      ),
    ).toBe(true);
  });

  it('does not treat different headcount as similar', () => {
    expect(
      arePostBodiesSimilar(
        '找组队，6.13-6.14，上海，1人',
        '找组队，6.13-6.14，上海，2人',
      ),
    ).toBe(false);
  });

  it('does not treat unrelated short text as similar', () => {
    expect(arePostBodiesSimilar('求同路', '求拼房')).toBe(false);
  });
});
