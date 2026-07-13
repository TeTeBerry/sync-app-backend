import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TasteSignal,
  TasteSignalDocument,
  type TasteSignalType,
} from '@src/database/schemas/taste-signal.schema';
import {
  ANONYMOUS_SIGNAL_TTL_DAYS,
  SIGNAL_BASE_WEIGHT,
  decayedWeight,
} from './utils/taste-weights';

export type CreateTasteSignalInput = {
  userId?: string;
  anonymousId?: string;
  eventId?: string;
  artistId?: string;
  signalType: TasteSignalType;
  mood?: string;
  metadata?: Record<string, unknown>;
  source?: 'behavior' | 'legacy-personality' | 'merge';
  occurredAt?: Date;
  /** When true, skip near-duplicate check. */
  force?: boolean;
  /**
   * Internal-only weight override (legacy migration).
   * Never accept from client controllers.
   */
  internalWeight?: number;
};

@Injectable()
export class TasteSignalsRepository {
  constructor(
    @InjectModel(TasteSignal.name)
    private readonly model: Model<TasteSignalDocument>,
  ) {}

  async insert(input: CreateTasteSignalInput): Promise<TasteSignalDocument> {
    const weight =
      typeof input.internalWeight === 'number'
        ? input.internalWeight
        : (SIGNAL_BASE_WEIGHT[input.signalType] ?? 0.1);
    const occurredAt = input.occurredAt ?? new Date();
    const expiresAt =
      input.userId || input.source === 'legacy-personality'
        ? undefined
        : new Date(
            occurredAt.getTime() +
              ANONYMOUS_SIGNAL_TTL_DAYS * 24 * 60 * 60 * 1000,
          );

    return this.model.create({
      userId: input.userId,
      anonymousId: input.anonymousId,
      eventId: input.eventId,
      artistId: input.artistId,
      signalType: input.signalType,
      mood: input.mood,
      weight,
      metadata: input.metadata,
      occurredAt,
      expiresAt,
      source: input.source ?? 'behavior',
    });
  }

  /**
   * Deduplicate noisy repeats within a short window for the same actor+type+artist.
   */
  async findRecentDuplicate(input: {
    userId?: string;
    anonymousId?: string;
    signalType: TasteSignalType;
    artistId?: string;
    eventId?: string;
    withinMs?: number;
  }): Promise<TasteSignalDocument | null> {
    const withinMs = input.withinMs ?? 60_000;
    const since = new Date(Date.now() - withinMs);
    const filter: Record<string, unknown> = {
      signalType: input.signalType,
      occurredAt: { $gte: since },
    };
    if (input.userId) filter.userId = input.userId;
    else if (input.anonymousId) filter.anonymousId = input.anonymousId;
    else return null;
    if (input.artistId) filter.artistId = input.artistId;
    if (input.eventId) filter.eventId = input.eventId;
    return this.model
      .findOne(filter)
      .sort({ occurredAt: -1 })
      .lean() as Promise<TasteSignalDocument | null>;
  }

  async listForActor(input: {
    userId?: string;
    anonymousId?: string;
    limit?: number;
  }): Promise<
    Array<{
      signalType: TasteSignalType;
      artistId?: string;
      eventId?: string;
      mood?: string;
      weight: number;
      occurredAt: Date;
      source?: string;
      metadata?: Record<string, unknown>;
    }>
  > {
    const filter: Record<string, unknown> = {};
    if (input.userId) filter.userId = input.userId;
    else if (input.anonymousId) filter.anonymousId = input.anonymousId;
    else return [];

    const docs = await this.model
      .find(filter)
      .sort({ occurredAt: -1 })
      .limit(input.limit ?? 400)
      .lean();

    return docs.map((doc) => ({
      signalType: doc.signalType,
      artistId: doc.artistId,
      eventId: doc.eventId,
      mood: doc.mood,
      weight: doc.weight,
      occurredAt: doc.occurredAt,
      source: doc.source,
      metadata: doc.metadata as Record<string, unknown> | undefined,
    }));
  }

  async mergeAnonymousToUser(
    anonymousId: string,
    userId: string,
  ): Promise<{ moved: number }> {
    const result = await this.model.updateMany(
      { anonymousId, userId: { $exists: false } },
      {
        $set: { userId, source: 'merge' },
        $unset: { expiresAt: 1 },
      },
    );
    // Keep anonymousId for audit; isolation is by userId after merge.
    return { moved: result.modifiedCount ?? 0 };
  }

  async aggregateArtistGenreWeights(input: {
    userId?: string;
    anonymousId?: string;
    genreByArtist: Map<string, string | null>;
  }): Promise<{
    artistWeights: Record<string, number>;
    genreWeights: Record<string, number>;
  }> {
    const signals = await this.listForActor({
      userId: input.userId,
      anonymousId: input.anonymousId,
    });
    const artistWeights: Record<string, number> = {};
    const genreWeights: Record<string, number> = {};
    const now = new Date();

    for (const signal of signals) {
      const decayed =
        signal.source === 'legacy-personality'
          ? signal.weight
          : decayedWeight(
              signal.signalType,
              signal.weight,
              signal.occurredAt,
              now,
            );
      if (Math.abs(decayed) < 0.01) continue;
      if (signal.artistId) {
        artistWeights[signal.artistId] =
          (artistWeights[signal.artistId] ?? 0) + decayed;
        const genre = input.genreByArtist.get(signal.artistId);
        if (genre) {
          genreWeights[genre] = (genreWeights[genre] ?? 0) + decayed * 0.85;
        }
      }
      // Legacy personality stores genre tags in metadata without artistId.
      const metaGenre =
        signal.source === 'legacy-personality' &&
        typeof signal.metadata?.genre === 'string'
          ? signal.metadata.genre
          : null;
      if (metaGenre) {
        genreWeights[metaGenre] = (genreWeights[metaGenre] ?? 0) + decayed;
      }
    }

    return { artistWeights, genreWeights };
  }
}
