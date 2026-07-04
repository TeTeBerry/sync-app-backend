import { Test } from '@nestjs/testing';
import { toRequestActor } from '@src/common/auth/actor-query.util';
import { TripPlanMembersService } from '@src/modules/trip-plan/trip-plan-members.service';
import { TripPlanService } from '@src/modules/trip-plan/trip-plan.service';
import { UserService } from '@src/modules/user/user.service';

describe('TripPlanMembersService', () => {
  const actor = toRequestActor('user-1', 'Berry');
  const tripPlanService = {
    getById: jest.fn(),
  };
  const userService = {
    findAuthorSummariesByExternalIds: jest.fn(),
  };

  let service: TripPlanMembersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    tripPlanService.getById.mockResolvedValue({
      id: 'trip-1',
      ownerId: 'owner-1',
      memberIds: ['owner-1', 'user-1'],
    });
    userService.findAuthorSummariesByExternalIds.mockResolvedValue(
      new Map([
        ['owner-1', { name: '小明', avatar: 'https://cdn/a.png' }],
        ['user-1', { name: 'Berry', avatar: '' }],
      ]),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        TripPlanMembersService,
        { provide: TripPlanService, useValue: tripPlanService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = moduleRef.get(TripPlanMembersService);
  });

  it('returns member profiles for trip plan members', async () => {
    const result = await service.listMembers('trip-1', actor);

    expect(tripPlanService.getById).toHaveBeenCalledWith('trip-1', actor);
    expect(result).toEqual([
      {
        userId: 'owner-1',
        name: '小明',
        avatar: 'https://cdn/a.png',
        isOwner: true,
      },
      {
        userId: 'user-1',
        name: 'Berry',
        avatar: '',
        isOwner: false,
      },
    ]);
  });
});
