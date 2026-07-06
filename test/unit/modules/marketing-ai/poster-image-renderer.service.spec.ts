import { PosterImageRendererService } from '../../../../src/modules/marketing-ai/image-renderer/poster-image-renderer.service';
import { resolvePosterSize } from '../../../../src/modules/marketing-ai/image-renderer/poster-size.presets';

jest.mock('satori', () => ({
  __esModule: true,
  default: jest.fn(
    async () => '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  ),
}));

jest.mock('@resvg/resvg-js', () => ({
  Resvg: jest.fn().mockImplementation(() => ({
    render: () => ({
      asPng: () => Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    }),
  })),
}));

describe('PosterImageRendererService', () => {
  const service = new PosterImageRendererService();

  it('loads fonts and returns a PNG buffer', async () => {
    const png = await service.renderPoster({
      festivalName: 'Tomorrowland Thailand 2026',
      festivalMeta: 'Pattaya, Thailand · Dec 5–7',
      topic: 'Travel guide',
      genres: ['EDM'],
      artists: ['Tiësto'],
      sections: [
        { headline: 'Getting there', body: 'Fly into U-Tapao' },
        { headline: 'Where to stay', body: 'Book early' },
      ],
      brandName: 'Raven',
      tagline: 'Festival travel planner',
      size: resolvePosterSize('4:5'),
    });

    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});
