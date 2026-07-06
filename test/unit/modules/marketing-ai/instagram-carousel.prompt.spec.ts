import { buildInstagramCarouselImagePrompt } from '../../../../src/modules/marketing-ai/image-prompts/instagram-carousel.prompt';
import type { InstagramAssetRequest } from '../../../../src/modules/marketing-ai/marketing-ai-instagram-asset.types';

describe('instagram-carousel.prompt', () => {
  const baseInput: InstagramAssetRequest = {
    festival: {
      id: 'tomorrowland-thailand-2026',
      name: 'Tomorrowland Thailand 2026',
      location: 'Pattaya',
      country: 'Thailand',
      dates: 'Dec 5–7',
      genres: ['EDM', 'Trance'],
      artists: ['Amelie Lens'],
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
      colorPalette: ['deep purple', 'electric blue', 'black'],
      typography: 'clean sans-serif',
      visualTone: ['festival travel', 'minimal', 'premium'],
      avoid: ['crowded party photos', 'cheap EDM flyer style'],
    },
    carousel: [
      {
        slide: 1,
        headline: 'Tomorrowland Thailand 2026',
        body: 'Pattaya · Dec 5–7',
        imageDescription:
          'Premium hero cover with Pattaya beach atmosphere and subtle stage light accents',
        overlayText: ['Tomorrowland Thailand 2026', 'Pattaya · Dec 5–7'],
        aspectRatio: '4:5',
      },
    ],
  };

  it('builds a structured Hunyuan prompt from asset request', () => {
    const prompt = buildInstagramCarouselImagePrompt(
      baseInput,
      baseInput.carousel[0],
    );

    expect(prompt).toContain('Instagram carousel slide');
    expect(prompt).toContain('Raven');
    expect(prompt).toContain('Tomorrowland Thailand 2026');
    expect(prompt).toContain(
      'Premium hero cover with Pattaya beach atmosphere',
    );
    expect(prompt).toContain('4:5 vertical');
    expect(prompt).toContain('crowded party photos');
    expect(prompt.length).toBeLessThanOrEqual(500);
  });
});
