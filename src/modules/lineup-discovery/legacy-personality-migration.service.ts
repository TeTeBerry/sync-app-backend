import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PersonalityTasteMigration,
  PersonalityTasteMigrationDocument,
} from '@src/database/schemas/personality-taste-migration.schema';
import {
  UserPersonalityTestResult,
  UserPersonalityTestResultDocument,
} from '@src/database/schemas/user-personality-test-result.schema';
import { PERSONALITY_TYPE_META } from '../personality-test/data/personality-types';
import type { RaverPersonalityType } from '../personality-test/personality-test.types';
import { TasteSignalsRepository } from './taste-signals.repository';
import { LEGACY_PERSONALITY_WEIGHT } from './utils/taste-weights';
import { canonicalizeGenre } from './utils/genre-normalization.util';

/**
 * One-shot migration: personality genre preferences → low-weight historical signals.
 * Does not delete original personality results.
 */
@Injectable()
export class LegacyPersonalityMigrationService {
  private readonly logger = new Logger(LegacyPersonalityMigrationService.name);

  constructor(
    @InjectModel(UserPersonalityTestResult.name)
    private readonly resultModel: Model<UserPersonalityTestResultDocument>,
    @InjectModel(PersonalityTasteMigration.name)
    private readonly migrationModel: Model<PersonalityTasteMigrationDocument>,
    private readonly tasteSignals: TasteSignalsRepository,
  ) {}

  async migrateIfNeeded(userId: string): Promise<{
    migrated: boolean;
    genreTags: string[];
  }> {
    const trimmed = userId.trim();
    if (!trimmed) return { migrated: false, genreTags: [] };

    const existing = await this.migrationModel
      .findOne({ userId: trimmed })
      .lean();
    if (existing) {
      return { migrated: false, genreTags: existing.genreTags ?? [] };
    }

    const stored = await this.resultModel.findOne({ userId: trimmed }).lean();
    const primaryType = stored?.result?.score?.primaryType as
      | RaverPersonalityType
      | undefined;
    if (!primaryType || !PERSONALITY_TYPE_META[primaryType]) {
      await this.migrationModel.create({
        userId: trimmed,
        migratedAt: new Date(),
        genreTags: [],
        primaryType,
      });
      return { migrated: false, genreTags: [] };
    }

    const meta = PERSONALITY_TYPE_META[primaryType];
    const genreTags = meta.genreTags
      .map((tag) => canonicalizeGenre(tag))
      .filter((tag): tag is string => Boolean(tag));

    const occurredAt = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    for (const genre of genreTags) {
      await this.tasteSignals.insert({
        userId: trimmed,
        signalType: 'festival_viewed',
        metadata: {
          legacyPersonality: true,
          genre,
          primaryType,
        },
        source: 'legacy-personality',
        occurredAt,
        force: true,
        internalWeight: LEGACY_PERSONALITY_WEIGHT,
      });
    }

    await this.migrationModel.create({
      userId: trimmed,
      migratedAt: new Date(),
      genreTags,
      primaryType,
    });

    this.logger.log(
      `Migrated legacy personality genres for user ${trimmed}: ${genreTags.join(',')}`,
    );
    return { migrated: true, genreTags };
  }

  /**
   * Apply low fixed weight genre bias from migrated personality —
   * never overrides explicit behavior (additive only at LEGACY_PERSONALITY_WEIGHT).
   */
  applyLegacyGenreBias(
    genreWeights: Record<string, number>,
    genreTags: string[],
  ): Record<string, number> {
    const next = { ...genreWeights };
    for (const tag of genreTags) {
      next[tag] = (next[tag] ?? 0) + LEGACY_PERSONALITY_WEIGHT;
    }
    return next;
  }
}
