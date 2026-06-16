import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PersonalityDjCatalog,
  type PersonalityDjCatalogDocument,
} from '@src/database/schemas/personality-dj-catalog.schema';
import {
  PersonalityQuestionCatalog,
  type PersonalityQuestionCatalogDocument,
} from '@src/database/schemas/personality-question-catalog.schema';
import {
  PersonalityTypeCatalog,
  type PersonalityTypeCatalogDocument,
} from '@src/database/schemas/personality-type-catalog.schema';
import { buildPersonalityDjCatalogSeed } from './data/personality-dj-catalog.seed';
import {
  buildPersonalityCatalogSeed,
  PERSONALITY_TEST_CATALOG_VERSION,
} from './data/personality-test-catalog.seed';
import {
  DJ_SOUL_PROFILES,
  EDC_KOREA_PERSONALITY_LINEUP,
  type DjSoulProfile,
} from './data/personality-lineup';
import {
  PERSONALITY_QUESTION_SLOTS,
  type PersonalityQuestionSlot,
} from './data/personality-question-slots';
import { buildPersonalityTypeCatalogSeed } from './data/personality-type-catalog.seed';
import {
  PERSONALITY_TYPE_META,
  type PersonalityTypeMeta,
} from './data/personality-types';
import type { PersonalityTestRuntimeCatalog } from './personality-test-catalog.types';
import type {
  PersonalityLineupDj,
  PersonalityQuestion,
  RaverPersonalityType,
} from './personality-test.types';
import {
  resolvePersonalityQuestionsByIds,
  selectPersonalityQuestions,
} from './utils/select-personality-questions.util';
import { PERSONALITY_QUESTION_POOLS } from './data/personality-question-pools';

@Injectable()
export class PersonalityTestCatalogService implements OnModuleInit {
  private readonly logger = new Logger(PersonalityTestCatalogService.name);

  constructor(
    @InjectModel(PersonalityQuestionCatalog.name)
    private readonly questionModel: Model<PersonalityQuestionCatalogDocument>,
    @InjectModel(PersonalityTypeCatalog.name)
    private readonly typeModel: Model<PersonalityTypeCatalogDocument>,
    @InjectModel(PersonalityDjCatalog.name)
    private readonly djModel: Model<PersonalityDjCatalogDocument>,
  ) {}

  async onModuleInit() {
    await this.seedCatalogData();
  }

  async seedCatalogData() {
    const questionSeed = buildPersonalityCatalogSeed();
    for (const item of questionSeed) {
      await this.questionModel.findOneAndUpdate(
        { questionId: item.questionId },
        item,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    const activeQuestionIds = questionSeed.map((item) => item.questionId);
    await this.questionModel.updateMany(
      { questionId: { $nin: activeQuestionIds } },
      { $set: { active: false } },
    );

    const typeSeed = buildPersonalityTypeCatalogSeed();
    for (const item of typeSeed) {
      await this.typeModel.findOneAndUpdate({ type: item.type }, item, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
    }
    const activeTypes = typeSeed.map((item) => item.type);
    await this.typeModel.updateMany(
      { type: { $nin: activeTypes } },
      { $set: { active: false } },
    );

    const djSeed = buildPersonalityDjCatalogSeed();
    for (const item of djSeed) {
      await this.djModel.findOneAndUpdate({ djId: item.djId }, item, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
    }
    const activeDjIds = djSeed.map((item) => item.djId);
    await this.djModel.updateMany(
      { djId: { $nin: activeDjIds } },
      { $set: { active: false } },
    );

    this.logger.log(
      `Personality test catalog seeded (${questionSeed.length} questions, ${typeSeed.length} types, ${djSeed.length} DJs, v${PERSONALITY_TEST_CATALOG_VERSION})`,
    );
  }

  async getRuntimeCatalog(): Promise<PersonalityTestRuntimeCatalog> {
    const [typeMeta, fallbackLineup, soulProfiles] = await Promise.all([
      this.getTypeMetaMap(),
      this.getFallbackLineup(),
      this.getSoulProfiles(),
    ]);
    return { typeMeta, fallbackLineup, soulProfiles };
  }

  async getTypeMetaMap(): Promise<
    Record<RaverPersonalityType, PersonalityTypeMeta>
  > {
    const docs = await this.typeModel.find({ active: true }).lean();
    if (!docs.length) {
      return PERSONALITY_TYPE_META;
    }

    const map = { ...PERSONALITY_TYPE_META };
    for (const doc of docs) {
      map[doc.type] = {
        type: doc.type,
        emoji: doc.emoji,
        label: doc.label,
        labelEn: doc.labelEn,
        description: doc.description,
        genreTags: doc.genreTags,
        primaryColor: doc.primaryColor,
        targetVector: doc.targetVector,
        dimensionWeights: doc.dimensionWeights,
      };
    }
    return map;
  }

  async getFallbackLineup(): Promise<PersonalityLineupDj[]> {
    const docs = await this.djModel
      .find({ active: true, includeInFallbackLineup: true })
      .sort({ sortOrder: 1, popularity: -1 })
      .lean();

    if (!docs.length) {
      return EDC_KOREA_PERSONALITY_LINEUP;
    }

    return docs.map((doc) => ({
      id: doc.djId,
      name: doc.name,
      genre: doc.genre,
      genreLabel: doc.genreLabel,
      stage: doc.stage,
      popularity: doc.popularity,
      genreColor: doc.genreColor,
    }));
  }

  async getSoulProfiles(): Promise<Record<string, DjSoulProfile>> {
    const docs = await this.djModel
      .find({ active: true, soulProfile: { $exists: true, $ne: null } })
      .lean();

    if (!docs.length) {
      return DJ_SOUL_PROFILES;
    }

    const profiles: Record<string, DjSoulProfile> = {};
    for (const doc of docs) {
      if (doc.soulProfile) {
        profiles[doc.djId] = doc.soulProfile;
      }
    }
    return profiles;
  }

  async getPools(): Promise<
    Record<PersonalityQuestionSlot, PersonalityQuestion[]>
  > {
    const docs = await this.questionModel
      .find({ active: true })
      .sort({ slot: 1, questionId: 1 })
      .lean();

    if (docs.length === 0) {
      return PERSONALITY_QUESTION_POOLS;
    }

    const pools = Object.fromEntries(
      PERSONALITY_QUESTION_SLOTS.map((slot) => [
        slot,
        [] as PersonalityQuestion[],
      ]),
    ) as Record<PersonalityQuestionSlot, PersonalityQuestion[]>;

    for (const doc of docs) {
      const slot = doc.slot as PersonalityQuestionSlot;
      if (!PERSONALITY_QUESTION_SLOTS.includes(slot)) {
        continue;
      }
      pools[slot].push(this.toQuestion(doc));
    }

    for (const slot of PERSONALITY_QUESTION_SLOTS) {
      if (pools[slot].length === 0) {
        pools[slot] = PERSONALITY_QUESTION_POOLS[slot];
      }
    }

    return pools;
  }

  async selectQuestions(
    random: () => number = Math.random,
  ): Promise<PersonalityQuestion[]> {
    const pools = await this.getPools();
    return selectPersonalityQuestions(random, pools);
  }

  async resolveByIds(questionIds: string[]): Promise<PersonalityQuestion[]> {
    const pools = await this.getPools();
    return resolvePersonalityQuestionsByIds(questionIds, pools);
  }

  private toQuestion(
    doc: Pick<
      PersonalityQuestionCatalog,
      'questionId' | 'prompt' | 'options' | 'media' | 'weightMultiplier'
    >,
  ): PersonalityQuestion {
    return {
      id: doc.questionId,
      prompt: doc.prompt,
      options: doc.options,
      media: doc.media,
      weightMultiplier: doc.weightMultiplier,
    };
  }
}
