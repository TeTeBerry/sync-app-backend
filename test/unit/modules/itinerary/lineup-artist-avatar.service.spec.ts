import { LineupArtistAvatarService } from '@src/modules/itinerary/lineup-artist-avatar.service';

describe('LineupArtistAvatarService', () => {
  const exec = jest.fn();
  const model = {
    find: jest.fn(() => ({
      select: jest.fn(() => ({
        lean: jest.fn(() => ({
          exec,
        })),
      })),
    })),
  };
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      CLOUDBASE_ENV_ID: 'sync-prd-test',
      CLOUDBASE_STORAGE_BUCKET: '7379-sync-prd-test',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('normalizes lineup avatar asset keys to CloudBase file ids', async () => {
    exec.mockResolvedValue([
      {
        artistNameKey: 'afrojack',
        avatarUrl: 'lineup-avatar/afrojack.jpg',
        source: 'cloud',
      },
    ]);

    const service = new LineupArtistAvatarService(model as never);
    const urls = await service.findAvatarUrlsByArtistNames(['AFROJACK']);

    expect(urls.get('afrojack')).toBe(
      'cloud://sync-prd-test.7379-sync-prd-test/lineup-avatar/afrojack.jpg',
    );
  });

  it('rejects Discogs avatar rows', async () => {
    exec.mockResolvedValue([
      {
        artistNameKey: 'afrojack',
        avatarUrl: 'https://i.discogs.com/example.jpg',
        source: 'discogs',
      },
    ]);

    const service = new LineupArtistAvatarService(model as never);
    const urls = await service.findAvatarUrlsByArtistNames(['AFROJACK']);

    expect(urls.has('afrojack')).toBe(false);
  });
});
