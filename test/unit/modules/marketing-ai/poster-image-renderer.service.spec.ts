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

  it('loads fonts and returns a PNG buffer for travel guide poster', async () => {
    const png = await service.renderTravelGuidePoster({
      title: 'Tomorrowland Belgium 2026',
      titleFlag: '🇧🇪',
      sectionTitle: 'Festival Travel Guide',
      locationLine: 'De Schorre, Boom',
      dateLine: 'July 17–19, 2026',
      guideItems: [
        {
          icon: '🏨',
          label: 'STAY',
          subtitle: 'Hotels & best areas near the festival',
        },
      ],
      follow: 'FOLLOW @RAVEN',
      tagline: "Your guide to the world's best festivals",
      taglineIcon: '🌎',
      size: resolvePosterSize('1:1'),
    });

    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});
