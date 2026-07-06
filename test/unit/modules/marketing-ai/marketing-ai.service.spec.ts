import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LlmService } from '../../../../src/infra/llm/llm.service';
import { X_CONTENT_STYLE } from '../../../../src/modules/marketing-ai/marketing-ai.post-process';
import { MarketingAiService } from '../../../../src/modules/marketing-ai/marketing-ai.service';

describe('MarketingAiService', () => {
  const invokeJson = jest.fn();
  let llmEnabled = true;

  const llmService = {
    get enabled() {
      return llmEnabled;
    },
    invokeJson,
  } as unknown as jest.Mocked<Pick<LlmService, 'enabled' | 'invokeJson'>>;

  let service: MarketingAiService;

  beforeEach(async () => {
    jest.clearAllMocks();
    llmEnabled = true;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingAiService,
        { provide: LlmService, useValue: llmService },
      ],
    }).compile();

    service = module.get(MarketingAiService);
  });

  const baseInput = {
    brandVoice: 'bold and inclusive',
    festival: { name: 'EDC Las Vegas', year: 2026 },
    contentType: 'hook' as const,
    language: 'en',
  };

  it('throws when LLM is disabled', async () => {
    llmEnabled = false;

    await expect(
      service.generatePlatformContent({ ...baseInput, platform: 'threads' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('returns normalized threads content as text-only visual', async () => {
    invokeJson.mockResolvedValue({
      title: 'Ready for the desert?',
      content: 'EDC season is calling.',
      hashtags: ['#edc', 'festival'],
      cta: '',
      notes: '',
      visualBrief: {
        visualType: 'carousel',
        imagePrompt: 'should be ignored for discussion threads',
      },
    });

    const result = await service.generatePlatformContent({
      ...baseInput,
      platform: 'threads',
    });

    expect(result).toMatchObject({
      platform: 'threads',
      title: 'Ready for the desert?',
      content: 'EDC season is calling.',
      hashtags: ['edc', 'festival'],
      cta: '',
      contentStyle: 'community-discussion',
      visualBrief: { visualType: 'text-only' },
    });
    expect(invokeJson).toHaveBeenCalledTimes(1);
  });

  it('returns instagram caption with visual brief', async () => {
    invokeJson.mockResolvedValue({
      title: 'Festival packing list',
      content: 'Save this before you fly.',
      hashtags: ['edc', 'festivalguide'],
      cta: 'Save for your trip',
      notes: 'Carousel: 5 slides',
      visualBrief: {
        visualType: 'carousel',
        aspectRatio: '4:5',
        imagePrompt: 'Dark premium travel carousel with purple gradient',
        designLayout: 'Slide 1 hook, Slide 2-4 tips, Slide 5 CTA',
        overlayText: ['Pack smart', 'Book early'],
        assetsNeeded: ['festival map', 'packing flat lay'],
        referenceStyle: 'Raven premium dark gradient',
      },
    });

    const result = await service.generatePlatformContent({
      ...baseInput,
      platform: 'instagram',
      contentType: 'guide',
    });

    expect(result.platform).toBe('instagram');
    expect(result.contentStyle).toBe('visual-storytelling');
    expect(result.visualBrief).toMatchObject({
      visualType: 'carousel',
      aspectRatio: '4:5',
      imagePrompt: expect.stringContaining('carousel'),
      overlayText: ['Pack smart', 'Book early'],
    });
  });

  it('returns tiktok video brief', async () => {
    invokeJson.mockResolvedValue({
      title: 'POV planning chaos',
      content: 'You booked the festival but your tabs are still open.',
      hashtags: ['festival', 'travel'],
      cta: 'Follow for more',
      visualBrief: {
        visualType: 'short-video',
        aspectRatio: '9:16',
        videoPrompt: 'Fast POV planning montage',
        designLayout: 'Shot 1 hook face cam\nShot 2 laptop tabs',
        overlayText: ['6 apps open'],
        assetsNeeded: ['screen recording', 'ticket screenshot'],
        notes: 'Hook in 3s, fast cuts, upbeat electronic bed',
      },
    });

    const result = await service.generatePlatformContent({
      ...baseInput,
      platform: 'tiktok',
    });

    expect(result.visualBrief).toMatchObject({
      visualType: 'short-video',
      aspectRatio: '9:16',
      videoPrompt: expect.any(String),
      designLayout: expect.stringContaining('Shot 1'),
    });
  });

  it('enforces founder build-in-public rules for X', async () => {
    invokeJson.mockResolvedValue({
      title: 'Ignore',
      content:
        'Festival travel is fragmented across apps — flights, hotels, tickets, group chat. That chaos is what we are solving.',
      hashtags: ['raven', 'startup'],
      cta: 'Try Raven today',
      notes: '',
      visualBrief: { visualType: 'single-image' },
    });

    const result = await service.generatePlatformContent({
      ...baseInput,
      platform: 'x',
    });

    expect(result.contentStyle).toBe(X_CONTENT_STYLE);
    expect(result.cta).toBe('');
    expect(result.hashtags).toEqual([]);
    expect(result.title).toBe('');
    expect(result.visualBrief).toEqual({ visualType: 'text-only' });
    expect(result.content.length).toBeLessThanOrEqual(280);
    expect(result.content).not.toMatch(/try raven/i);
  });

  it('retries X once when first draft is promotional', async () => {
    invokeJson
      .mockResolvedValueOnce({
        content: 'Discover Raven and plan your next festival smarter!',
        hashtags: ['raven'],
        cta: 'Join Raven',
      })
      .mockResolvedValueOnce({
        content:
          'Most travel tools optimize for destinations. Festival trips fix the event — everything around it is chaos.',
        hashtags: [],
        cta: '',
      });

    const result = await service.generatePlatformContent({
      ...baseInput,
      platform: 'x',
    });

    expect(invokeJson).toHaveBeenCalledTimes(2);
    expect(result.content).not.toMatch(/discover raven/i);
    expect(result.cta).toBe('');
    expect(result.hashtags).toEqual([]);
    expect(result.visualBrief).toEqual({ visualType: 'text-only' });
  });

  it('truncates X content longer than 280 characters', async () => {
    const longBody = 'A'.repeat(300);
    invokeJson.mockResolvedValue({
      content: longBody,
      hashtags: [],
      cta: '',
    });

    const result = await service.generatePlatformContent({
      ...baseInput,
      platform: 'x',
    });

    expect(result.content.length).toBeLessThanOrEqual(280);
    expect(result.notes).toMatch(/Truncated/);
  });

  it('returns reddit reply without strong marketing CTA', async () => {
    invokeJson.mockResolvedValue({
      title: '',
      content:
        'For a first-timer, book accommodation early and plan one must-see stage per day so you are not sprinting the whole weekend.',
      hashtags: [],
      cta: '',
      notes: '',
      visualBrief: { visualType: 'carousel' },
    });

    const result = await service.generatePlatformContent({
      ...baseInput,
      platform: 'reddit',
      contentType: 'guide',
    });

    expect(result.contentStyle).toBe('helpful-reply');
    expect(result.cta).toBe('');
    expect(result.visualBrief).toEqual({ visualType: 'text-only' });
    expect(result.content).not.toMatch(/sign up|download|try raven/i);
  });

  it('allows threads visual brief for guide planner content type', async () => {
    invokeJson.mockResolvedValue({
      content: 'Here is a checklist before you fly.',
      visualBrief: {
        visualType: 'single-image',
        imagePrompt: 'Minimal checklist card',
        designLayout: 'Single checklist graphic',
        overlayText: ['5 things before you fly'],
      },
    });

    const result = await service.generatePlatformContent({
      ...baseInput,
      platform: 'threads',
      festival: {
        name: 'EDC',
        plannerContentType: 'guide',
      },
    });

    expect(result.visualBrief).toMatchObject({
      visualType: 'single-image',
      aspectRatio: '1:1',
      imagePrompt: 'Minimal checklist card',
    });
  });

  it('throws when LLM returns empty content', async () => {
    invokeJson.mockResolvedValue({ title: 'x', content: '  ' });

    await expect(
      service.generatePlatformContent({ ...baseInput, platform: 'threads' }),
    ).rejects.toThrow(BadRequestException);
  });
});
