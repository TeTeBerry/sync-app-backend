import { Test } from '@nestjs/testing';
import { ArtistProfileResolver } from '@src/modules/itinerary/artist-profile-resolver.service';
import { LineupCatalogService } from '@src/modules/itinerary/lineup-catalog.service';
import { DjService } from '@src/modules/dj/dj.service';

describe('ArtistProfileResolver', () => {
  it('merges catalog profile into artist detail', async () => {
    const lineupCatalog = {
      resolveCatalogLineupArtistById: jest.fn().mockResolvedValue({
        id: 'dj-snake',
        name: 'DJ Snake',
        genreLabel: 'Trap',
        activityCount: 1,
      }),
    };
    const djService = {
      lookupForLineupArtists: jest.fn().mockResolvedValue(
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
      ),
      resolveProfileForDisplay: jest
        .fn()
        .mockResolvedValue('International DJ profile text'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ArtistProfileResolver,
        { provide: LineupCatalogService, useValue: lineupCatalog },
        { provide: DjService, useValue: djService },
      ],
    }).compile();

    const resolver = moduleRef.get(ArtistProfileResolver);
    const artist = await resolver.getCatalogLineupArtistDetail('dj-snake');

    expect(artist.name).toBe('DJ Snake');
    expect(artist.profileFull).toBe('International DJ profile text');
    expect(artist.profileSummary).toContain('International DJ');
  });

  it('uses seed fallback profile when Discogs is skipped for seed-only artists', async () => {
    const lineupCatalog = {
      resolveCatalogLineupArtistById: jest.fn().mockResolvedValue({
        id: 'crush',
        name: 'CRUSH',
        genre: 'Hardstyle',
        genreLabel: 'Hardstyle · Rawstyle',
        activityCount: 1,
      }),
    };
    const djService = {
      lookupForLineupArtists: jest.fn().mockResolvedValue(new Map()),
      resolveProfileForDisplay: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ArtistProfileResolver,
        { provide: LineupCatalogService, useValue: lineupCatalog },
        { provide: DjService, useValue: djService },
      ],
    }).compile();

    const resolver = moduleRef.get(ArtistProfileResolver);
    const artist = await resolver.getCatalogLineupArtistDetail('crush');

    expect(artist.genre).toBe('Hardstyle');
    expect(artist.genreLabel).toBe('Hardstyle · Rawstyle');
    expect(artist.profileSummary).toContain('Hardstyle');
    expect(artist.representativeTracks).toBeUndefined();
    expect(djService.resolveProfileForDisplay).not.toHaveBeenCalled();
  });
});
