import {
  DEFAULT_POSTER_SIZE_ID,
  POSTER_SIZE_IDS,
  resolvePosterSize,
} from '../../../../src/modules/marketing-ai/image-renderer/poster-size.presets';

describe('poster-size.presets', () => {
  it('exposes all supported poster sizes', () => {
    expect(POSTER_SIZE_IDS).toEqual([
      '4:5',
      '1:1',
      '9:16',
      '4:3',
      '16:9',
      'mobile',
      'desktop',
    ]);
  });

  it('defaults to Instagram square 1:1', () => {
    const preset = resolvePosterSize(DEFAULT_POSTER_SIZE_ID);

    expect(preset).toMatchObject({
      width: 1080,
      height: 1080,
      contentWidth: 1024,
      outerPadding: 28,
      cardPadding: 52,
    });
  });

  it('matches md2poster mobile dimensions', () => {
    const preset = resolvePosterSize('mobile');

    expect(preset).toMatchObject({
      width: 512,
      height: 640,
      outerPadding: 16,
    });
  });
});
