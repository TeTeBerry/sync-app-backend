import { DjInfoResolverService } from '@src/ai/dj/dj-info-resolver.service';

describe('DjInfoResolverService', () => {
  const marshMessages = [
    { role: 'user' as const, content: 'Marshmello 什么风格' },
    {
      role: 'assistant' as const,
      content: 'Marshmello 以 Future Bass、Pop EDM 为主。',
    },
  ];

  it('uses LLM to resolve similar-artist follow-up from conversation', async () => {
    const llmService = {
      enabled: true,
      invokeJson: jest.fn().mockResolvedValue({
        intent: 'similar_artists',
        referenceArtist: 'Marshmello',
        styles: ['Future Bass'],
        scope: 'catalog',
      }),
    };

    const resolver = new DjInfoResolverService(llmService as never);
    const query = await resolver.resolve({
      messages: marshMessages,
      input: '帮我找类似风格的DJ',
      activityLegacyId: 4,
      toolArgs: {
        intent: 'artist_profile',
        artistName: '帮我找类似风格的DJ',
      },
    });

    expect(llmService.invokeJson).toHaveBeenCalled();
    expect(query).toMatchObject({
      intent: 'similar_artists',
      referenceArtist: 'Marshmello',
      scope: 'catalog',
    });
  });

  it('resolves performance follow-up from conversation context', async () => {
    const llmService = {
      enabled: true,
      invokeJson: jest.fn().mockResolvedValue({
        intent: 'artist_performances',
        artistName: 'Marshmello',
        scope: 'catalog',
      }),
    };

    const resolver = new DjInfoResolverService(llmService as never);
    const query = await resolver.resolve({
      messages: [
        { role: 'user', content: 'Marshmello' },
        {
          role: 'assistant',
          content: '想了解近期演出还是类似艺人？',
        },
      ],
      input: '近期演出',
    });

    expect(query).toMatchObject({
      intent: 'artist_performances',
      artistName: 'Marshmello',
    });
  });

  it('resolves discography follow-up from conversation context', async () => {
    const llmService = {
      enabled: true,
      invokeJson: jest.fn().mockResolvedValue({
        intent: 'artist_discography',
        artistName: 'Marshmello',
        scope: 'catalog',
      }),
    };

    const resolver = new DjInfoResolverService(llmService as never);
    const query = await resolver.resolve({
      messages: marshMessages,
      input: '代表作有哪些',
    });

    expect(query).toMatchObject({
      intent: 'artist_discography',
      artistName: 'Marshmello',
    });
  });

  it('overrides wrong LLM referenceArtist with most recent conversation anchor', async () => {
    const llmService = {
      enabled: true,
      invokeJson: jest.fn().mockResolvedValue({
        intent: 'similar_artists',
        referenceArtist: 'Marshmello',
        styles: ['Future Bass'],
        scope: 'catalog',
      }),
    };

    const resolver = new DjInfoResolverService(llmService as never);
    const query = await resolver.resolve({
      messages: [
        { role: 'user', content: 'Marshmello 什么风格' },
        {
          role: 'assistant',
          content: 'Marshmello 以 Future Bass、Pop EDM 为主。',
        },
        { role: 'user', content: 'Martin Garrix 是什么风格' },
        {
          role: 'assistant',
          content:
            'Martin Garrix · Netherlands\n🎧 风格：Big Room · Progressive House',
        },
      ],
      input: '找类似风格的 DJ',
    });

    expect(query).toMatchObject({
      intent: 'similar_artists',
      referenceArtist: 'Martin Garrix',
    });
  });

  it('falls back to tool args when LLM is disabled', async () => {
    const llmService = {
      enabled: false,
      invokeJson: jest.fn(),
    };

    const resolver = new DjInfoResolverService(llmService as never);
    const query = await resolver.resolve({
      messages: [],
      input: 'Illenium 是什么风格',
      toolArgs: {
        intent: 'artist_profile',
        artistName: 'Illenium',
      },
    });

    expect(llmService.invokeJson).not.toHaveBeenCalled();
    expect(query).toMatchObject({
      intent: 'artist_profile',
      artistName: 'Illenium',
    });
  });
});
