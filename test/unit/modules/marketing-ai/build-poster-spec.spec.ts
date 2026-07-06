import {
  buildPosterRendererLabel,
  buildPosterSpec,
} from '../../../../src/modules/marketing-ai/image-renderer/build-poster-spec';
import type { InstagramAssetRequest } from '../../../../src/modules/marketing-ai/marketing-ai-instagram-asset.types';

describe('build-poster-spec', () => {
  const baseInput: InstagramAssetRequest = {
    festival: {
      id: 'tomorrowland-thailand-2026',
      name: 'Tomorrowland Thailand 2026',
      location: 'Pattaya',
      country: 'Thailand',
      dates: 'Dec 5–7',
      genres: ['EDM', 'House'],
      artists: ['Tiësto', 'Armin van Buuren'],
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
        headline: 'Tomorrowland Thailand 2026',
        body: 'Your travel + vibe guide',
        imageDescription: 'Hero cover',
        overlayText: ['Tomorrowland Thailand 2026'],
        aspectRatio: '4:5',
      },
      {
        slide: 2,
        headline: 'Getting there',
        body: 'Fly into U-Tapao',
        imageDescription: 'Travel tip',
        overlayText: ['Getting there'],
        aspectRatio: '4:5',
      },
      {
        slide: 3,
        headline: 'Where to stay',
        body: 'Book early',
        imageDescription: 'Stay tip',
        overlayText: ['Where to stay'],
        aspectRatio: '4:5',
      },
    ],
  };

  it('builds a consolidated poster spec with festival header and sections', () => {
    const spec = buildPosterSpec(baseInput);

    expect(spec).toMatchObject({
      festivalName: 'Tomorrowland Thailand 2026',
      festivalMeta: 'Pattaya, Thailand · Dec 5–7',
      topic: 'Travel guide',
      brandName: 'Raven',
      size: { id: '4:5', width: 1080, height: 1350 },
    });
    expect(spec.sections).toHaveLength(3);
    expect(spec.sections[0]).toEqual({
      headline: 'Your travel + vibe guide',
      body: '',
    });
    expect(spec.sections[1]).toEqual({
      headline: 'Getting there',
      body: 'Fly into U-Tapao',
    });
  });

  it('uses outputSize when provided', () => {
    const spec = buildPosterSpec({
      ...baseInput,
      outputSize: '1:1',
    });

    expect(spec.size).toMatchObject({ id: '1:1', width: 1080, height: 1080 });
  });

  it('builds renderer label with sync-web poster size', () => {
    const spec = buildPosterSpec(baseInput);

    expect(buildPosterRendererLabel(spec)).toBe(
      'poster-sync-web-4:5-1080x1350: Tomorrowland Thailand 2026',
    );
  });
});
