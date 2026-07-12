import { BadRequestException } from '@nestjs/common';
import { FestivalSquadService } from '@src/modules/festival-squad/festival-squad.service';

describe('FestivalSquadService presence controls', () => {
  const actor = { resolvedUserId: 'viewer', source: 'jwt' as const };
  const visibility = {
    showExactCity: true,
    showCountryOnly: false,
    showAccommodationName: true,
    showAccommodationTypeOnly: false,
    allowConnectionRequests: true,
    hideProfile: false,
  };

  it('does not query candidates when the viewer paused matching', async () => {
    const repository = {
      findProfile: jest.fn().mockResolvedValue({
        matchingPaused: true,
        visibility,
      }),
      findProfilesForEvent: jest.fn(),
    };
    const service = new FestivalSquadService(repository as never, {} as never);

    await expect(service.matches(actor as never, 12)).resolves.toEqual([]);
    expect(repository.findProfilesForEvent).not.toHaveBeenCalled();
  });

  it('blocks new requests to a hidden profile', async () => {
    const repository = {
      findProfile: jest.fn().mockResolvedValue({
        _id: 'sender-profile',
        matchingPaused: false,
        visibility,
      }),
      findProfileById: jest.fn().mockResolvedValue({
        _id: 'receiver-profile',
        userId: 'another-user',
        eventId: 12,
        matchingPaused: false,
        visibility: { ...visibility, hideProfile: true },
      }),
    };
    const service = new FestivalSquadService(repository as never, {} as never);

    await expect(
      service.createConnectionRequest(actor as never, {
        eventId: 12,
        receiverProfileId: '507f1f77bcf86cd799439011',
        intent: 'festival_buddy',
        message: 'Hello',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
