import {
  parseDjNamesFromUserText,
  resolveDjIdsFromNames,
} from '@src/ai/agent/itinerary-chat-slots.util';

describe('itinerary-chat-slots.util', () => {
  const lineup = [
    {
      id: 'marshmello',
      name: 'Marshmello',
      genre: 'edm',
      genreLabel: 'EDM',
      stage: 'main' as const,
      popularity: 90,
      avatarSeed: 'm',
      genreColor: '#fff',
    },
    {
      id: 'martin-garrix',
      name: 'Martin Garrix',
      genre: 'edm',
      genreLabel: 'EDM',
      stage: 'main' as const,
      popularity: 88,
      avatarSeed: 'g',
      genreColor: '#fff',
    },
  ];

  it('parses multiple dj names from user text', () => {
    expect(parseDjNamesFromUserText('Marshmello、Martin Garrix')).toEqual([
      'Marshmello',
      'Martin Garrix',
    ]);
  });

  it('resolves dj ids from lineup names', () => {
    expect(resolveDjIdsFromNames(['Marshmello', 'Garrix'], lineup)).toEqual([
      'marshmello',
      'martin-garrix',
    ]);
  });
});
