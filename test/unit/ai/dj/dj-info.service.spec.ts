import { DjInfoService } from '@src/ai/dj/dj-info.service';

describe('DjInfoService', () => {
  const djService = {
    searchByName: jest.fn(),
    searchByStyles: jest.fn(),
  };
  const djLocaleService = {
    localizeCatalogItem: jest.fn(async (item: unknown) => item),
  };
  const scheduleService = {
    getSchedule: jest.fn(),
    findArtistPerformances: jest.fn(),
  };
  const djInfoResolver = {
    resolve: jest.fn(),
  };

  let service: DjInfoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DjInfoService(
      djService as never,
      djLocaleService as never,
      scheduleService as never,
      djInfoResolver as never,
    );
  });

  it('answers artist discography from catalog representativeWorks', async () => {
    djService.searchByName.mockResolvedValue({
      items: [
        {
          discogsId: 1,
          name: 'Marshmello',
          genres: [],
          styles: [],
          representativeWorks: [
            {
              releaseId: 10,
              title: 'Alone',
              year: 2016,
              tracks: ['Alone'],
            },
          ],
        },
      ],
      total: 1,
      limit: 3,
      skip: 0,
    });

    const { replyText } = await service.answerFromStructured({
      intent: 'artist_discography',
      artistName: 'Marshmello',
      styles: [],
      scope: 'catalog',
    });

    expect(replyText).toContain('Marshmello 代表作');
    expect(replyText).toContain('Alone (2016)');
    expect(replyText).toContain('· Alone');
  });

  it('returns not-found message when artist is missing from catalog', async () => {
    djService.searchByName.mockResolvedValue({
      items: [],
      total: 0,
      limit: 3,
      skip: 0,
    });

    const { replyText } = await service.answerFromStructured({
      intent: 'artist_discography',
      artistName: 'Unknown DJ',
      styles: [],
      scope: 'catalog',
    });

    expect(replyText).toContain('没在艺人库里找到');
  });
});
