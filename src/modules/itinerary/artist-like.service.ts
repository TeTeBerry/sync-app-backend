import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserArtistLike,
  UserArtistLikeDocument,
} from '../../database/schemas/user-artist-like.schema';

@Injectable()
export class ArtistLikeService {
  constructor(
    @InjectModel(UserArtistLike.name)
    private readonly model: Model<UserArtistLikeDocument>,
  ) {}

  async getFavoriteArtistIds(userId: string): Promise<string[]> {
    const docs = await this.model.find({ userId }).lean();
    return docs.map((doc) => doc.artistId);
  }

  async addFavorite(userId: string, artistId: string): Promise<void> {
    await this.model.findOneAndUpdate(
      { userId, artistId },
      { userId, artistId },
      { upsert: true, new: true },
    );
  }

  async removeFavorite(userId: string, artistId: string): Promise<void> {
    await this.model.deleteOne({ userId, artistId });
  }
}
