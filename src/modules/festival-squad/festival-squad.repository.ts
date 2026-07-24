import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConnectionRequest,
  ConnectionRequestDocument,
} from '../../database/schemas/connection-request.schema';
import {
  FestivalSquadProfile,
  FestivalSquadProfileDocument,
} from '../../database/schemas/festival-squad-profile.schema';

type DeleteOneResult = { acknowledged: boolean; deletedCount: number };

@Injectable()
export class FestivalSquadRepository {
  constructor(
    @InjectModel(FestivalSquadProfile.name)
    private readonly profiles: Model<FestivalSquadProfileDocument>,
    @InjectModel(ConnectionRequest.name)
    private readonly requests: Model<ConnectionRequestDocument>,
  ) {}
  findProfile(userId: string, eventId: number) {
    return this.profiles.findOne({ userId, eventId }).exec();
  }
  findProfilesByUser(userId: string) {
    return this.profiles.find({ userId }).exec();
  }
  upsertProfile(userId: string, input: Record<string, unknown>) {
    return this.profiles
      .findOneAndUpdate(
        { userId, eventId: input.eventId },
        { $set: { ...input, userId } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
  updateProfileSettings(
    userId: string,
    eventId: number,
    input: Record<string, unknown>,
  ) {
    return this.profiles
      .findOneAndUpdate({ userId, eventId }, { $set: input }, { new: true })
      .exec();
  }
  findProfilesForEvent(eventId: number, excludeUserId: string) {
    return this.profiles
      .find({
        eventId,
        userId: { $ne: excludeUserId },
        matchingPaused: { $ne: true },
        'visibility.hideProfile': { $ne: true },
      })
      .sort({ updatedAt: -1 })
      .exec();
  }
  countProfiles(eventId: number) {
    return this.profiles
      .countDocuments({
        eventId,
        matchingPaused: { $ne: true },
        'visibility.hideProfile': { $ne: true },
      })
      .exec();
  }
  countProfilesByIntent(eventId: number, intent: string) {
    return this.profiles
      .countDocuments({
        eventId,
        lookingFor: intent,
        matchingPaused: { $ne: true },
        'visibility.hideProfile': { $ne: true },
      })
      .exec();
  }
  findProfileById(id: string) {
    return this.profiles.findById(id).exec();
  }
  deleteProfile(userId: string, eventId: number): Promise<DeleteOneResult> {
    return this.profiles.deleteOne({ userId, eventId }).exec();
  }
  async deleteProfileAndRequests(
    userId: string,
    eventId: number,
    profileId: string,
  ) {
    await this.requests
      .deleteMany({
        eventId,
        $or: [{ senderProfileId: profileId }, { receiverProfileId: profileId }],
      })
      .exec();
    await this.profiles.deleteOne({ userId, eventId }).exec();
  }
  createRequest(input: Record<string, unknown>) {
    return this.requests.create(input);
  }
  findPendingRequest(
    senderProfileId: string,
    receiverProfileId: string,
    eventId: number,
  ) {
    return this.requests
      .findOne({
        senderProfileId,
        receiverProfileId,
        eventId,
        status: 'pending',
      })
      .exec();
  }
  listRequests(profileIds: string[]) {
    return this.requests
      .find({
        $or: [
          { senderProfileId: { $in: profileIds } },
          { receiverProfileId: { $in: profileIds } },
        ],
      })
      .sort({ createdAt: -1 })
      .exec();
  }
  findRequest(id: string) {
    return this.requests.findById(id).exec();
  }
}
