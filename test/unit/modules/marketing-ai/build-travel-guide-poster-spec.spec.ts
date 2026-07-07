import {
  buildTravelGuidePosterSpec,
  buildTravelGuideRendererLabel,
} from '../../../../src/modules/marketing-ai/image-renderer/build-travel-guide-poster-spec';
import type { InstagramAssetRequest } from '../../../../src/modules/marketing-ai/marketing-ai-instagram-asset.types';

describe('build-travel-guide-poster-spec', () => {
  const baseInput: InstagramAssetRequest = {
    festival: {
      id: 'tomorrowland-belgium-2026',
      name: 'Tomorrowland Belgium 2026',
      venue: 'De Schorre',
      location: 'Boom',
      country: 'Belgium',
      startDate: '2026-07-17',
      endDate: '2026-07-19',
      lineupArtists: [
        { name: 'Martin Garrix' },
        { name: 'Armin van Buuren' },
        { name: 'Tiësto' },
      ],
    },
    publishingPackage: {
      topic: 'Travel guide',
      caption: 'Caption body',
      hashtags: ['Tomorrowland'],
      publishTime: '18:30 GMT+7',
    },
    brandStyle: {
      brandName: 'Raven',
      mood: 'premium',
      background: 'dark',
      colorPalette: ['#8b7cf8', '#6e66e8', '#08080c'],
      typography: 'clean sans-serif',
      visualTone: ['festival travel', 'minimal', 'premium'],
      avoid: ['crowded party photos'],
    },
    carousel: [
      {
        slide: 1,
        headline: 'Tomorrowland Belgium 2026',
        body: 'Your travel + vibe guide',
        imageDescription: 'Hero cover',
        overlayText: ['Tomorrowland Belgium 2026'],
        aspectRatio: '1:1',
      },
    ],
  };

  it('builds travel guide poster content matching reference layout', () => {
    const spec = buildTravelGuidePosterSpec(baseInput);

    expect(spec).toMatchObject({
      title: 'Tomorrowland Belgium 2026',
      titleFlag: '🇧🇪',
      sectionTitle: 'Festival Travel Guide',
      locationLine: 'De Schorre, Boom',
      dateLine: 'July 17–19, 2026',
      follow: 'FOLLOW @RAVEN',
      tagline: "Your guide to the world's best festivals",
      taglineIcon: '🌎',
      size: { id: '1:1', width: 1080, height: 1080 },
    });
    expect(spec.guideItems[0]).toEqual({
      icon: '🏨',
      label: 'STAY',
      subtitle: 'Hotels & best areas near the festival',
    });
    expect(spec.guideItems).toHaveLength(3);
  });

  it('builds renderer label with travel guide poster size', () => {
    const spec = buildTravelGuidePosterSpec(baseInput);

    expect(buildTravelGuideRendererLabel(spec)).toBe(
      'travel-guide-poster-1:1-1080x1080: Tomorrowland Belgium 2026',
    );
  });
});
