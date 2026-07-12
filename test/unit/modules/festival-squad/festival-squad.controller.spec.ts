import { FestivalSquadController } from '@src/modules/festival-squad/festival-squad.controller';

describe('FestivalSquadController endpoints', () => {
  const service = {
    upsertProfile: jest.fn(),
    updateProfileSettings: jest.fn(),
    getProfileForEvent: jest.fn(),
    deleteProfile: jest.fn(),
    matches: jest.fn(),
    travelerStats: jest.fn(),
    createConnectionRequest: jest.fn(),
    listConnectionRequests: jest.fn(),
    updateConnectionRequest: jest.fn(),
  };
  const controller = new FestivalSquadController(service as never);
  const actor = { resolvedUserId: 'user-1', source: 'jwt' as const };
  it('routes all profile, matching, traveler, and connection endpoints through the authenticated actor', () => {
    controller.createProfile('1', {} as never, actor as never);
    controller.profileMe('1', actor as never);
    controller.updateProfile('1', {} as never, actor as never);
    controller.updateProfileSettings(
      '1',
      { matchingPaused: true },
      actor as never,
    );
    controller.deleteProfile('1', actor as never);
    controller.matches('1', actor as never);
    controller.travelers('1', actor as never);
    controller.createRequest({ eventId: 1 } as never, actor as never);
    controller.listRequests(actor as never);
    controller.updateRequest(
      'request-1',
      { status: 'accepted' },
      actor as never,
    );
    expect(service.upsertProfile).toHaveBeenCalledWith(actor, 1, {});
    expect(service.updateProfileSettings).toHaveBeenCalledWith(actor, 1, {
      matchingPaused: true,
    });
    expect(service.getProfileForEvent).toHaveBeenCalledWith(actor, 1);
    expect(service.deleteProfile).toHaveBeenCalledWith(actor, 1);
    expect(service.matches).toHaveBeenCalledWith(actor, 1);
    expect(service.travelerStats).toHaveBeenCalledWith(actor, 1);
    expect(service.createConnectionRequest).toHaveBeenCalledWith(actor, {
      eventId: 1,
    });
    expect(service.listConnectionRequests).toHaveBeenCalledWith(actor);
    expect(service.updateConnectionRequest).toHaveBeenCalledWith(
      actor,
      'request-1',
      { status: 'accepted' },
    );
  });
});
