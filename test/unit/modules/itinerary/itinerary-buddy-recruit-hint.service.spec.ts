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
      { findRecruitingByActivityForMatch: jest.fn() } as never,
    );

    const result = await service.getHint(4, [], actor);
    expect(result).toEqual({
      recruitingCount: 0,
      highlightGenre: '',
      genreLabels: [],
    });
  });

  it('counts distinct recruiting authors for the activity', async () => {
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
    const postRepository = {
      findRecruitingByActivityForMatch: jest.fn().mockResolvedValue([
        { _id: 'p1', userId: 'u1' },
        { _id: 'p2', userId: 'u2' },
        { _id: 'p3', userId: 'u1' },
      ]),
    };

    const service = new ItineraryBuddyRecruitHintService(
      scheduleService as never,
      {
        findByLegacyId: jest.fn().mockResolvedValue({ name: '风暴' }),
      } as never,
      postRepository as never,
    );

    const result = await service.getHint(4, ['dj1'], actor);
    expect(result.recruitingCount).toBe(2);
    expect(result.highlightGenre).toBe('Techno');
    expect(
      postRepository.findRecruitingByActivityForMatch,
    ).toHaveBeenCalledWith(4);
  });
});
