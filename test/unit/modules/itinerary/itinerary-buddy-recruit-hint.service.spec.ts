import { ItineraryBuddyRecruitHintService } from '@src/modules/itinerary/itinerary-buddy-recruit-hint.service';
import type { RequestActor } from '@src/common/auth/request-actor.types';

describe('ItineraryBuddyRecruitHintService', () => {
  const actor = {
    resolvedUserId: 'viewer-1',
    clientUserId: 'viewer-1',
  } as RequestActor;

  it('returns zero when no DJs selected', async () => {
    const service = new ItineraryBuddyRecruitHintService(
      { getSchedule: jest.fn() } as never,
      { findByLegacyId: jest.fn() } as never,
      { search: jest.fn() } as never,
      { findByIds: jest.fn() } as never,
    );

    const result = await service.getHint(4, [], actor);
    expect(result).toEqual({
      recruitingCount: 0,
      highlightGenre: '',
      genreLabels: [],
    });
  });

  it('counts distinct recruiting authors from match results', async () => {
    const scheduleService = {
      getSchedule: jest.fn().mockResolvedValue({
        djs: [
          {
            id: 'dj1',
            name: 'A',
            genre: 'techno',
            genreLabel: 'Techno',
            stage: 'main',
            popularity: 1,
            avatarSeed: 'a',
            genreColor: '#fff',
          },
        ],
      }),
    };
    const matchService = {
      search: jest.fn().mockResolvedValue({
        items: [{ postId: 'p1' }, { postId: 'p2' }],
        degraded: false,
      }),
    };
    const postRepository = {
      findByIds: jest.fn().mockResolvedValue([
        { _id: 'p1', userId: 'u1' },
        { _id: 'p2', userId: 'u2' },
      ]),
    };

    const service = new ItineraryBuddyRecruitHintService(
      scheduleService as never,
      {
        findByLegacyId: jest.fn().mockResolvedValue({ name: '风暴' }),
      } as never,
      matchService as never,
      postRepository as never,
    );

    const result = await service.getHint(4, ['dj1'], actor);
    expect(result.recruitingCount).toBe(2);
    expect(result.highlightGenre).toBe('Techno');
    expect(matchService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        criteria: expect.objectContaining({
          activityLegacyId: 4,
          profileFavorGenres: ['Techno'],
        }),
      }),
    );
  });
});
