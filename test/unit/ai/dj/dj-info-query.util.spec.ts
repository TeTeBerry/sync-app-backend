import {
  applyDjConversationAnchor,
  enrichDjUserQuery,
  extractDjStyles,
  isDjInfoIntent,
  isPlausibleArtistName,
  parseDjInfoQuery,
  parseDjInfoQueryWithContext,
  resolveDjChatContext,
} from '@src/ai/dj/dj-info-query.util';

describe('dj-info-query.util', () => {
  it('detects artist style questions', () => {
    expect(isDjInfoIntent('Marshmello 是什么风格')).toBe(true);
    expect(isDjInfoIntent('介绍一下 Korolova')).toBe(true);
  });

  it('detects lineup style filters', () => {
    expect(isDjInfoIntent('这场有哪些 Techno DJ')).toBe(true);
    expect(isDjInfoIntent('阵容里有哪些 house')).toBe(true);
  });

  it('extracts normalized styles', () => {
    expect(extractDjStyles('有哪些 dnb 和 big room DJ')).toEqual([
      'Drum & Bass',
      'Big Room',
    ]);
  });

  it('parses artist profile query', () => {
    expect(parseDjInfoQuery('Illenium 是什么风格')).toEqual({
      kind: 'artist_profile',
      artistName: 'Illenium',
      styles: [],
    });
  });

  it('parses lineup by style query', () => {
    expect(parseDjInfoQuery('这场阵容有哪些 Techno')).toEqual({
      kind: 'lineup_by_style',
      styles: ['Techno'],
    });
  });

  it('parses catalog style query without lineup keyword', () => {
    expect(parseDjInfoQuery('有哪些 Bass House DJ')).toEqual({
      kind: 'catalog_by_style',
      styles: ['Bass House'],
    });
  });

  it('detects similar-style follow-up without explicit artist', () => {
    expect(isDjInfoIntent('帮我找类似风格的DJ')).toBe(true);
  });

  it('does not treat search commands as artist names', () => {
    expect(isPlausibleArtistName('帮我找类似风格的DJ')).toBe(false);
    expect(isPlausibleArtistName('Marshmello')).toBe(true);
    expect(parseDjInfoQuery('帮我找类似风格的DJ').artistName).toBeUndefined();
  });

  it('resolves artist and styles from prior turns', () => {
    const messages = [
      { role: 'user' as const, content: 'Marshmello 什么风格' },
      {
        role: 'assistant' as const,
        content:
          'Marshmello 是以 **Melodic House / Future Bass / Pop EDM** 为主风格的制作人。',
      },
    ];

    expect(resolveDjChatContext(messages)).toMatchObject({
      referenceArtist: 'Marshmello',
      styles: expect.arrayContaining([
        'Future Bass',
        'Melodic House',
        'Pop EDM',
      ]),
    });

    expect(parseDjInfoQueryWithContext('帮我找类似风格的DJ', messages)).toEqual(
      {
        kind: 'catalog_by_style',
        styles: expect.arrayContaining(['Future Bass']),
        referenceArtist: 'Marshmello',
      },
    );

    expect(enrichDjUserQuery(messages, '帮我找类似风格的DJ')).toContain(
      '参考艺人：Marshmello',
    );
  });

  it('prefers the most recent artist when older turns mention another DJ', () => {
    const messages = [
      { role: 'user' as const, content: 'Marshmello 什么风格' },
      {
        role: 'assistant' as const,
        content: 'Marshmello 以 Future Bass、Pop EDM 为主。',
      },
      { role: 'user' as const, content: 'Martin Garrix 是什么风格' },
      {
        role: 'assistant' as const,
        content:
          'Martin Garrix · Netherlands\n🎧 风格：Big Room · Progressive House\n荷兰 DJ，代表作 Animals。',
      },
    ];

    expect(resolveDjChatContext(messages)).toMatchObject({
      referenceArtist: 'Martin Garrix',
      styles: expect.arrayContaining(['Big Room']),
    });

    expect(
      applyDjConversationAnchor(
        {
          intent: 'similar_artists',
          referenceArtist: 'Marshmello',
          styles: ['Future Bass'],
          scope: 'catalog',
        },
        messages,
        '找类似风格的 DJ',
      ),
    ).toMatchObject({
      intent: 'similar_artists',
      referenceArtist: 'Martin Garrix',
    });
  });
});
