import {
  applyDefaultPostProcess,
  applyXPostProcess,
  buildInstagramPublishingFields,
  isPromotionalXContent,
  normalizeVisualBrief,
  truncateXContent,
  X_MAX_LENGTH,
} from '../../../../src/modules/marketing-ai/marketing-ai.post-process';

describe('marketing-ai.post-process', () => {
  describe('isPromotionalXContent', () => {
    it('flags marketing phrases', () => {
      expect(isPromotionalXContent('Discover Raven today')).toBe(true);
      expect(isPromotionalXContent('Join Raven for smarter planning')).toBe(
        true,
      );
      expect(isPromotionalXContent('Sign up now for early access')).toBe(true);
    });

    it('allows founder-style insights', () => {
      expect(
        isPromotionalXContent(
          'Festival trips fix the event — everything around it is chaos.',
        ),
      ).toBe(false);
    });
  });

  describe('truncateXContent', () => {
    it('truncates beyond 280 characters', () => {
      const truncated = truncateXContent('x'.repeat(300));
      expect(truncated.length).toBeLessThanOrEqual(X_MAX_LENGTH);
    });
  });

  describe('applyXPostProcess', () => {
    it('clears hashtags and cta and forces text-only visual', () => {
      const result = applyXPostProcess(
        {
          title: 'Marketing title',
          content: 'A calm founder observation about festival logistics.',
          hashtags: ['raven', 'startup'],
          cta: 'Try Raven',
          visualBrief: { visualType: 'single-image' },
        },
        'founder-build-in-public',
      );

      expect(result.hashtags).toEqual([]);
      expect(result.cta).toBe('');
      expect(result.title).toBe('');
      expect(result.contentStyle).toBe('founder-build-in-public');
      expect(result.visualBrief).toEqual({ visualType: 'text-only' });
    });
  });

  describe('normalizeVisualBrief', () => {
    it('defaults instagram carousel brief', () => {
      const brief = normalizeVisualBrief(
        'instagram',
        {
          visualBrief: {
            visualType: 'carousel',
            imagePrompt: 'Premium festival travel carousel',
          },
        },
        {},
      );

      expect(brief).toMatchObject({
        visualType: 'carousel',
        aspectRatio: '4:5',
        imagePrompt: 'Premium festival travel carousel',
      });
    });

    it('forces reddit text-only', () => {
      expect(
        normalizeVisualBrief(
          'reddit',
          { visualBrief: { visualType: 'carousel' } },
          {},
        ),
      ).toEqual({ visualType: 'text-only' });
    });
  });

  describe('buildInstagramPublishingFields', () => {
    it('builds five carousel slides with default publish time', () => {
      const fields = buildInstagramPublishingFields(
        { publishTime: '', carousel: [] },
        { name: 'Tomorrowland Thailand' },
        'Travel Guide',
        'Line one\nLine two\nLine three',
        {
          visualType: 'carousel',
          overlayText: ['Slide hook', 'Tip two'],
        },
      );

      expect(fields.publishTime).toBe('18:30 GMT+7');
      expect(fields.carousel).toHaveLength(5);
      expect(fields.carousel?.[0]).toMatchObject({
        slide: 1,
        headline: 'Slide hook',
      });
    });
  });

  describe('applyDefaultPostProcess', () => {
    it('includes instagram carousel and publish time', () => {
      const result = applyDefaultPostProcess(
        {
          title: 'Travel Guide',
          content: 'Caption body',
          hashtags: ['tomorrowland'],
          carousel: [
            { slide: 1, headline: 'Getting there', body: 'Fly early' },
          ],
        },
        'visual-storytelling',
        'instagram',
        { name: 'Tomorrowland Thailand' },
      );

      expect(result.publishTime).toBe('18:30 GMT+7');
      expect(result.carousel?.[0]).toMatchObject({
        slide: 1,
        headline: 'Getting there',
      });
    });

    it('includes instagram visual brief without duplicating carousel logic for other platforms', () => {
      const result = applyDefaultPostProcess(
        {
          title: 'Travel Guide',
          content: 'Caption body',
          hashtags: ['tomorrowland'],
          visualBrief: {
            visualType: 'carousel',
            imagePrompt: 'Premium travel carousel',
            designLayout: 'Slide 1 hook',
          },
        },
        'visual-storytelling',
        'instagram',
        { name: 'Tomorrowland Thailand' },
      );

      expect(result.visualBrief).toMatchObject({
        visualType: 'carousel',
        aspectRatio: '4:5',
      });
      expect(result.carousel).toHaveLength(5);
    });
  });
});
