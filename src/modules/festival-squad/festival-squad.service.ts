import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type {
  ConnectionRequest,
  ConnectionRequestDocument,
} from '../../database/schemas/connection-request.schema';
import type {
  FestivalSquadProfile,
  FestivalSquadProfileDocument,
} from '../../database/schemas/festival-squad-profile.schema';
import {
  CreateConnectionRequestDto,
  UpdateFestivalSquadProfileSettingsDto,
  UpdateConnectionRequestDto,
  UpsertFestivalSquadProfileDto,
} from './dto/festival-squad.dto';
import { FestivalSquadMatcher } from './festival-squad.matcher';
import { FestivalSquadRepository } from './festival-squad.repository';

function profileDto(doc: FestivalSquadProfileDocument, includeOwner = false) {
  const raw = doc.toObject() as unknown as FestivalSquadProfile & {
    _id: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
  const visibility = {
    showExactCity: raw.visibility?.showExactCity !== false,
    showCountryOnly: raw.visibility?.showCountryOnly === true,
    showAccommodationName: raw.visibility?.showAccommodationName !== false,
    showAccommodationTypeOnly:
      raw.visibility?.showAccommodationTypeOnly === true,
    allowConnectionRequests: raw.visibility?.allowConnectionRequests !== false,
    hideProfile: raw.visibility?.hideProfile === true,
  };
  const publicOriginCity = visibility.showExactCity ? raw.originCity : '';
  const publicOriginCountry =
    visibility.showExactCity || visibility.showCountryOnly
      ? raw.originCountry
      : undefined;
  return {
    id: String(raw._id),
    ...(includeOwner ? { userId: raw.userId } : {}),
    eventId: raw.eventId,
    displayName: raw.displayName,
    avatarUrl: raw.avatarUrl,
    originCity: includeOwner ? raw.originCity : publicOriginCity,
    originCountry: includeOwner ? raw.originCountry : publicOriginCountry,
    arrivalDate: raw.arrivalDate,
    departureDate: raw.departureDate,
    accommodationStatus: raw.accommodationStatus,
    accommodationType:
      includeOwner ||
      visibility.showAccommodationTypeOnly ||
      visibility.showAccommodationName
        ? raw.accommodationType
        : 'not_decided',
    accommodationName:
      includeOwner || visibility.showAccommodationName
        ? raw.accommodationName
        : undefined,
    budgetLevel: raw.budgetLevel,
    favoriteArtistIds: raw.favoriteArtistIds ?? [],
    favoriteArtists: raw.favoriteArtists ?? [],
    favoriteGenres: raw.favoriteGenres ?? [],
    lookingFor: raw.lookingFor ?? [],
    languages: raw.languages ?? [],
    groupSize: raw.groupSize,
    firstTimeAttendee: raw.firstTimeAttendee,
    shortNote: raw.shortNote,
    visibility,
    ...(includeOwner ? { matchingPaused: raw.matchingPaused === true } : {}),
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}
function requestDto(doc: ConnectionRequestDocument) {
  const raw = doc.toObject() as unknown as ConnectionRequest & {
    _id: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
  return {
    id: String(raw._id),
    senderProfileId: raw.senderProfileId,
    receiverProfileId: raw.receiverProfileId,
    eventId: raw.eventId,
    intent: raw.intent,
    message: raw.message,
    status: raw.status,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

@Injectable()
export class FestivalSquadService {
  constructor(
    private readonly repository: FestivalSquadRepository,
    private readonly matcher: FestivalSquadMatcher,
  ) {}
  async upsertProfile(
    actor: RequestActor,
    eventId: number,
    dto: UpsertFestivalSquadProfileDto,
  ) {
    this.assertActor(actor);
    if (!Number.isInteger(eventId) || eventId < 1)
      throw new BadRequestException('Invalid event.');
    const profile = await this.repository.upsertProfile(actor.resolvedUserId, {
      ...dto,
      eventId,
    } as unknown as Record<string, unknown>);
    return profileDto(profile, true);
  }
  async getProfileForEvent(actor: RequestActor, eventId: number) {
    this.assertActor(actor);
    const profile = await this.repository.findProfile(
      actor.resolvedUserId,
      eventId,
    );
    return profile ? profileDto(profile, true) : null;
  }
  async updateProfileSettings(
    actor: RequestActor,
    eventId: number,
    dto: UpdateFestivalSquadProfileSettingsDto,
  ) {
    this.assertActor(actor);
    if (!Number.isInteger(eventId) || eventId < 1) {
      throw new BadRequestException('Invalid event.');
    }
    const existing = await this.repository.findProfile(
      actor.resolvedUserId,
      eventId,
    );
    if (!existing) throw new NotFoundException('Squad Profile not found.');
    const visibility = dto.visibility
      ? { ...(existing.visibility ?? {}), ...dto.visibility }
      : undefined;
    const profile = await this.repository.updateProfileSettings(
      actor.resolvedUserId,
      eventId,
      {
        ...(visibility ? { visibility } : {}),
        ...(dto.matchingPaused !== undefined
          ? { matchingPaused: dto.matchingPaused }
          : {}),
      },
    );
    if (!profile) throw new NotFoundException('Squad Profile not found.');
    return profileDto(profile, true);
  }
  async deleteProfile(actor: RequestActor, eventId: number) {
    this.assertActor(actor);
    const existing = await this.repository.findProfile(
      actor.resolvedUserId,
      eventId,
    );
    if (!existing) return;
    await this.repository.deleteProfileAndRequests(
      actor.resolvedUserId,
      eventId,
      String(existing._id),
    );
  }
  async matches(actor: RequestActor, eventId: number) {
    this.assertActor(actor);
    const viewer = await this.repository.findProfile(
      actor.resolvedUserId,
      eventId,
    );
    if (!viewer || viewer.matchingPaused || viewer.visibility?.hideProfile)
      return [];
    const candidates = await this.repository.findProfilesForEvent(
      eventId,
      actor.resolvedUserId,
    );
    return candidates
      .map((candidate) => ({
        profile: profileDto(candidate),
        ...this.matcher.match(viewer, candidate),
        warnings: [],
      }))
      .filter((match) => match.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.profile.id.localeCompare(b.profile.id),
      );
  }
  async travelerStats(actor: RequestActor, eventId: number) {
    this.assertActor(actor);
    const [travelerCount, roommates, buddies, rides, groups] =
      await Promise.all([
        this.repository.countProfiles(eventId),
        this.repository.countProfilesByIntent(eventId, 'roommate'),
        this.repository.countProfilesByIntent(eventId, 'festival_buddy'),
        this.repository.countProfilesByIntent(eventId, 'ride_share'),
        this.repository.countProfilesByIntent(eventId, 'travel_group'),
      ]);
    return {
      travelerCount,
      lookingForRoommates: roommates,
      lookingForBuddies: buddies,
      lookingForRideShares: rides,
      lookingForTravelGroups: groups,
    };
  }
  async createConnectionRequest(
    actor: RequestActor,
    dto: CreateConnectionRequestDto,
  ) {
    this.assertActor(actor);
    const sender = await this.repository.findProfile(
      actor.resolvedUserId,
      dto.eventId,
    );
    if (!sender) throw new BadRequestException('Create a Squad Profile first.');
    const receiver = await this.repository.findProfileById(
      dto.receiverProfileId,
    );
    if (!receiver || receiver.eventId !== dto.eventId)
      throw new NotFoundException('Traveler not found.');
    if (receiver.userId === actor.resolvedUserId)
      throw new BadRequestException('You cannot connect with yourself.');
    if (
      sender.matchingPaused ||
      sender.visibility?.hideProfile ||
      receiver.matchingPaused ||
      receiver.visibility?.hideProfile ||
      receiver.visibility?.allowConnectionRequests === false
    ) {
      throw new BadRequestException(
        'This traveler is not open to new matches.',
      );
    }
    const existing = await this.repository.findPendingRequest(
      String(sender._id),
      String(receiver._id),
      dto.eventId,
    );
    if (existing)
      throw new BadRequestException('Connection request is already pending.');
    try {
      return requestDto(
        await this.repository.createRequest({
          ...dto,
          senderProfileId: String(sender._id),
          status: 'pending',
        }),
      );
    } catch {
      throw new BadRequestException('Connection request is already pending.');
    }
  }
  async listConnectionRequests(actor: RequestActor) {
    this.assertActor(actor);
    const profiles = await this.repository.findProfilesByUser(
      actor.resolvedUserId,
    );
    const ids = profiles.map((profile) => String(profile._id));
    const requests = ids.length ? await this.repository.listRequests(ids) : [];
    const profileById = new Map(
      profiles.map((profile) => [String(profile._id), profile]),
    );
    const present = async (
      request: ConnectionRequestDocument,
      mineId: string,
      otherId: string,
    ) => {
      const mine =
        profileById.get(mineId) ??
        (await this.repository.findProfileById(mineId));
      const other = await this.repository.findProfileById(otherId);
      if (!mine || !other) return requestDto(request);
      const match = this.matcher.match(mine, other);
      return {
        ...requestDto(request),
        counterpart: profileDto(other),
        sharedArtistIds: match.sharedArtists,
        reasons: match.reasons.slice(0, 3),
      };
    };
    const [sent, received] = await Promise.all([
      Promise.all(
        requests
          .filter((request) => ids.includes(request.senderProfileId))
          .map((request) =>
            present(
              request,
              request.senderProfileId,
              request.receiverProfileId,
            ),
          ),
      ),
      Promise.all(
        requests
          .filter((request) => ids.includes(request.receiverProfileId))
          .map((request) =>
            present(
              request,
              request.receiverProfileId,
              request.senderProfileId,
            ),
          ),
      ),
    ]);
    return { sent, received };
  }
  async updateConnectionRequest(
    actor: RequestActor,
    id: string,
    dto: UpdateConnectionRequestDto,
  ) {
    this.assertActor(actor);
    const request = await this.repository.findRequest(id);
    if (!request) throw new NotFoundException('Connection request not found.');
    const receiver = await this.repository.findProfileById(
      request.receiverProfileId,
    );
    const sender = await this.repository.findProfileById(
      request.senderProfileId,
    );
    if (
      !sender ||
      !receiver ||
      sender.eventId !== receiver.eventId ||
      request.eventId !== receiver.eventId
    )
      throw new BadRequestException('Invalid cross-event request.');
    const isReceiver = receiver.userId === actor.resolvedUserId;
    const isSender = sender.userId === actor.resolvedUserId;
    if (request.status !== 'pending')
      throw new BadRequestException('This request can no longer change.');
    if ((dto.status === 'accepted' || dto.status === 'declined') && !isReceiver)
      throw new ForbiddenException('Only the recipient can respond.');
    if (dto.status === 'cancelled' && !isSender)
      throw new ForbiddenException('Only the sender can cancel.');
    request.status = dto.status;
    await request.save();
    return requestDto(request);
  }
  private assertActor(actor: RequestActor) {
    if (!actor.resolvedUserId)
      throw new ForbiddenException('Authentication required.');
  }
}
