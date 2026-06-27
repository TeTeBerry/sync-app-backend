import { Test } from '@nestjs/testing';
import { ArtistProfileResolver } from '@src/modules/itinerary/artist-profile-resolver.service';
import { LineupCatalogService } from '@src/modules/itinerary/lineup-catalog.service';
import { LineupArtistAvatarService } from '@src/modules/itinerary/lineup-artist-avatar.service';
import { DjService } from '@src/modules/dj/dj.service';

describe('ArtistProfileResolver', () => {
  const lineupCatalog = {
    resolveCatalogLineupArtistById: jest.fn(),
  };
  const djService = {
    lookupForLineupArtists: jest.fn(),
    resolveLineupCatalogBatch: jest.fn(),
    resolveProfileForDisplay: jest.fn(),
    loadCatalog: jest.fn(),
  };
  const lineupArtistAvatarService = {
    findAvatarUrlsByArtistNames: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map(),
    );
    djService.loadCatalog.mockResolvedValue([]);
  });

  async function createResolver() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArtistProfileResolver,
        { provide: LineupCatalogService, useValue: lineupCatalog },
        { provide: DjService, useValue: djService },
        {
          provide: LineupArtistAvatarService,
          useValue: lineupArtistAvatarService,
        },
      ],
    }).compile();

    return moduleRef.get(ArtistProfileResolver);
  }

  it('merges catalog profile into artist detail', async () => {
    lineupCatalog.resolveCatalogLineupArtistById.mockResolvedValue({
      id: 'dj-snake',
      name: 'DJ Snake',
      genreLabel: 'Trap',
      activityCount: 1,
    });
    djService.lookupForLineupArtists.mockResolvedValue(
      new Map([
        [
          'DJ Snake',
          {
            discogsId: 9,
            name: 'DJ Snake',
            profile: 'International DJ profile text',
            genres: ['Electronic'],
            styles: ['Trap'],
          },
        ],
      ]),
    );
    djService.resolveProfileForDisplay.mockResolvedValue(
      'International DJ profile text',
    );

    const resolver = await createResolver();
    const artist = await resolver.getCatalogLineupArtistDetail('dj-snake');

    expect(artist.name).toBe('DJ Snake');
    expect(artist.profileFull).toBe('International DJ profile text');
    expect(artist.profileSummary).toContain('International DJ');
    expect(artist.members).toBeUndefined();
  });

  it('does not synthesize profile from seed genres when catalog is empty', async () => {
    lineupCatalog.resolveCatalogLineupArtistById.mockResolvedValue({
      id: 'marshmello',
      name: 'MARSHMELLO',
      genre: 'Future Bass',
      genreLabel: 'Future Bass · Melodic Trap · Future House · Electro Pop',
      activityCount: 1,
    });
    djService.lookupForLineupArtists.mockResolvedValue(new Map());

    const resolver = await createResolver();
    const artist = await resolver.getCatalogLineupArtistDetail('marshmello');

    expect(artist.genre).toBe('Future Bass');
    expect(artist.profileSummary).toBeUndefined();
    expect(djService.resolveProfileForDisplay).not.toHaveBeenCalled();
  });

  it('returns member profiles for B2B lineup billing names', async () => {
    lineupCatalog.resolveCatalogLineupArtistById.mockResolvedValue({
      id: 'artbat-b2b-r3hab',
      name: 'ARTBAT B2B R3HAB',
      genre: 'Techno',
      genreLabel: 'Techno · House · Progressive House · Electro',
      activityCount: 1,
      thumbnail: 'https://cdn.example.com/artbat.jpg',
    });
    djService.resolveLineupCatalogBatch.mockResolvedValue({
      catalogByLineupName: new Map([
        [
          'ARTBAT',
          {
            discogsId: 1,
            name: 'Artbat',
            profile: 'Artbat profile',
            genres: ['Electronic'],
            styles: ['Techno'],
          },
        ],
        [
          'R3HAB',
          {
            discogsId: 2,
            name: 'R3hab',
            profile: 'R3hab profile',
            genres: ['Electronic'],
            styles: ['Electro House'],
          },
        ],
      ]),
      genreDisplayByLineupName: new Map([
        ['ARTBAT', { genre: 'Techno', genreLabel: 'Techno' }],
        ['R3HAB', { genre: 'Electro House', genreLabel: 'Electro House' }],
      ]),
    });
    djService.resolveProfileForDisplay.mockImplementation(
      async (_id: number, profile?: string) => profile,
    );
    lineupArtistAvatarService.findAvatarUrlsByArtistNames.mockResolvedValue(
      new Map([
        ['artbat', 'https://cdn.example.com/artbat.jpg'],
        ['r3hab', 'https://cdn.example.com/r3hab.jpg'],
      ]),
    );

    const resolver = await createResolver();
    const artist =
      await resolver.getCatalogLineupArtistDetail('artbat-b2b-r3hab');

    expect(artist.members).toHaveLength(2);
    expect(artist.members?.map((member) => member.name)).toEqual([
      'ARTBAT',
      'R3HAB',
    ]);
    expect(artist.members?.[0]?.profileSummary).toContain('Artbat');
    expect(artist.members?.[1]?.profileSummary).toContain('R3hab');
    expect(artist.members?.[0]?.thumbnail).toContain('artbat');
    expect(artist.members?.[1]?.thumbnail).toContain('r3hab');
    expect(artist.profileSummary).toBeUndefined();
    expect(artist.representativeTracks).toBeUndefined();
  });
});
