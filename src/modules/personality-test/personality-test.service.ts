import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserPersonalityTestResult,
  type UserPersonalityTestResultDocument,
} from '@src/database/schemas/user-personality-test-result.schema';
import { CloudStorageService } from '@src/infra/cloud/cloud-storage.service';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { DjService } from '../dj/dj.service';
import { ItineraryScheduleService } from '../itinerary/itinerary-schedule.service';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import { DEFAULT_DJ_SOUL_PROFILE } from './data/personality-lineup';
import { PERSONALITY_TEST_DRAW_COUNT } from './data/personality-question-slots';
import { PERSONALITY_TEST_CATALOG_VERSION } from './data/personality-test-catalog.seed';
import { PersonalityTestCatalogService } from './personality-test-catalog.service';
import type { PersonalityTestResult } from './personality-test.types';
import { recommendDjLineup } from './utils/recommend-dj-lineup.util';
import { buildPersonalityNarrative } from './utils/build-narrative.util';
import {
  LINEUP_POOL_EMPTY,
  recommendDjLineupFromCatalog,
} from './utils/recommend-dj-catalog.util';
import { recommendEventsForPersonality } from './utils/recommend-events.util';
import {
  isPersonalityTestComplete,
  scorePersonality,
} from './utils/score-personality.util';
import { ensurePersonalityResultIdentity } from './utils/personality-result-identity.util';
import { isValidPersonalityRaverNicknameQuery } from './utils/personality-nickname.util';
import type { SubmitPersonalityTestDto } from './dto/submit-personality-test.dto';
import {
  assertPersonalityStaticCloudFileIdForEnv,
  buildPersonalityCloudFileId,
  isPersonalityStaticAssetKey,
  resolveCloudStorageBucket,
} from './utils/personality-media-ref.util';
import {
  assertRaverAvatarCloudFileIdForEnv,
  isRaverAvatarAssetKey,
  isRaverAvatarCloudFileId,
} from './utils/personality-avatar-ref.util';
import {
  assertPlurStaticCloudFileIdForEnv,
  isPlurStaticAssetKey,
  isPlurStaticCloudFileId,
} from '../../common/media/plur-media-ref.util';
import { refreshPersonalityRecommendationGenres } from './utils/refresh-personality-recommendation-genres.util';

@Injectable()
export class PersonalityTestService {
  constructor(
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly djService: DjService,
    private readonly scheduleService: ItineraryScheduleService,
    private readonly catalog: PersonalityTestCatalogService,
    private readonly cloudStorage: CloudStorageService,
    @InjectModel(UserPersonalityTestResult.name)
    private readonly resultModel: Model<UserPersonalityTestResultDocument>,
  ) {}

  async getQuestions() {
    const questions = await this.catalog.selectQuestions();
    return {
      version: 1,
      questionCount: questions.length,
      questions,
      questionIds: questions.map((question) => question.id),
    };
  }

  async getCatalog() {
    const runtime = await this.catalog.getRuntimeCatalog();
    return {
      version: PERSONALITY_TEST_CATALOG_VERSION,
      types: Object.values(runtime.typeMeta),
      fallbackLineup: runtime.fallbackLineup,
      soulProfiles: runtime.soulProfiles,
      defaultSoulProfile: DEFAULT_DJ_SOUL_PROFILE,
    };
  }

  async resolveMediaUrls(assetKeys: string[]) {
    const envId = process.env.CLOUDBASE_ENV_ID?.trim() ?? '';
    const keys = assetKeys
      .map((key) => key.trim())
      .filter(
        (key) =>
          isPersonalityStaticAssetKey(key) ||
          isRaverAvatarAssetKey(key) ||
          isPlurStaticAssetKey(key),
      );
    const uniqueKeys = [...new Set(keys)];

    if (!uniqueKeys.length) {
      return { urls: {} as Record<string, string> };
    }

    if (!envId) {
      throw new BadRequestException('云存储未配置，无法解析测试媒体');
    }

    const fileIds = uniqueKeys.map((key) =>
      buildPersonalityCloudFileId(envId, key, resolveCloudStorageBucket()),
    );
    const downloads = await this.cloudStorage.fetchCloudFileDownloadUrls(
      fileIds,
      (fileId) => {
        if (isRaverAvatarCloudFileId(fileId)) {
          assertRaverAvatarCloudFileIdForEnv(fileId);
          return;
        }
        if (isPlurStaticCloudFileId(fileId)) {
          assertPlurStaticCloudFileIdForEnv(fileId);
          return;
        }
        assertPersonalityStaticCloudFileIdForEnv(fileId);
      },
      '无法读取测试媒体，请稍后再试',
    );

    const urls: Record<string, string> = {};
    uniqueKeys.forEach((key, index) => {
      const url = downloads[index]?.trim() ?? '';
      if (url) {
        urls[key] = url;
      }
    });
    return { urls };
  }

  async countRaverNicknameUsage(nickname: string): Promise<{
    nickname: string;
    userCount: number;
  }> {
    const trimmed = nickname.trim();
    if (!isValidPersonalityRaverNicknameQuery(trimmed)) {
      throw new BadRequestException('昵称格式无效');
    }

    const userCount = await this.resultModel.countDocuments({
      'result.raverNickname': trimmed,
    });

    return { nickname: trimmed, userCount };
  }

  async saveResult(
    actor: RequestActor,
    result: PersonalityTestResult,
  ): Promise<PersonalityTestResult> {
    const trimmedUserId = actor.resolvedUserId?.trim() ?? '';
    if (!trimmedUserId) {
      throw new BadRequestException('请先登录');
    }
    if (result.version !== 1) {
      throw new BadRequestException('无效的人格测试结果');
    }

    const saved = ensurePersonalityResultIdentity(result);
    await this.persistResult(trimmedUserId, saved);
    return saved;
  }

  async getSavedResult(userId: string): Promise<PersonalityTestResult | null> {
    const trimmed = userId.trim();
    if (!trimmed) {
      return null;
    }

    const doc = await this.resultModel.findOne({ userId: trimmed }).lean();
    if (!doc?.result || doc.result.version !== 1) {
      return null;
    }
    const upgraded = ensurePersonalityResultIdentity(doc.result);
    const withFreshGenres = await refreshPersonalityRecommendationGenres(
      upgraded,
      this.djService,
    );
    if (withFreshGenres !== doc.result) {
      await this.persistResult(trimmed, withFreshGenres);
    }
    return withFreshGenres;
  }

  /**
   * Keep personality recommendations inside the festival the visitor is
   * currently exploring. This is intentionally rule-based and therefore
   * explainable from the saved test score plus each artist's stored genre.
   */
  async getLineupMatch(activityLegacyId: number, actor: RequestActor) {
    const result = await this.getSavedResult(actor.resolvedUserId);
    if (!result) {
      return {
        available: false as const,
        reason: 'no_personality_result' as const,
      };
    }

    return this.getLineupMatchForResult(activityLegacyId, result);
  }

  async getLineupMatchForResult(
    activityLegacyId: number,
    result: PersonalityTestResult,
  ) {
    if (result.version !== 1 || !result.score?.primaryType) {
      return {
        available: false as const,
        reason: 'no_personality_result' as const,
      };
    }

    const runtimeCatalog = await this.catalog.getRuntimeCatalog();
    const type = runtimeCatalog.typeMeta[result.score.primaryType];
    if (!type) {
      return {
        available: false as const,
        reason: 'no_personality_result' as const,
      };
    }

    const schedule = await this.scheduleService.getSchedule(activityLegacyId);
    if (!schedule.djs.length) {
      return {
        available: false as const,
        reason: 'lineup_unavailable' as const,
      };
    }
    const seen = new Set<string>();
    const lineup = schedule.djs
      .filter((dj) => {
        if (seen.has(dj.id)) return false;
        seen.add(dj.id);
        return true;
      })
      .map((dj) => ({
        id: dj.id,
        name: dj.name,
        genre: dj.genre,
        genreLabel: dj.genreLabel,
        stage: 'main' as const,
        popularity: dj.popularity,
        genreColor: dj.genreColor,
      }));
    const recommendations = recommendDjLineup(result.score, lineup, {
      typeMeta: runtimeCatalog.typeMeta,
      soulProfiles: runtimeCatalog.soulProfiles,
    });
    return {
      available: true as const,
      personality: {
        type: result.score.primaryType,
        label: type.label,
        labelEn: type.labelEn,
        description: type.description,
        genreTags: type.genreTags,
        color: type.primaryColor,
      },
      recommendations,
    };
  }

  private async persistResult(
    userId: string,
    result: PersonalityTestResult,
  ): Promise<void> {
    const trimmed = userId.trim();
    if (!trimmed) {
      return;
    }

    await this.resultModel.findOneAndUpdate(
      { userId: trimmed },
      { userId: trimmed, result },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async submit(
    dto: SubmitPersonalityTestDto,
    actor: RequestActor,
  ): Promise<PersonalityTestResult> {
    if (dto.questionIds.length !== PERSONALITY_TEST_DRAW_COUNT) {
      throw new BadRequestException('题目信息无效，请重新开始测试');
    }

    const questions = await this.catalog.resolveByIds(dto.questionIds);
    if (questions.length !== PERSONALITY_TEST_DRAW_COUNT) {
      throw new BadRequestException('题目信息无效，请重新开始测试');
    }

    if (!isPersonalityTestComplete(dto.answers, questions)) {
      throw new BadRequestException('请完成全部题目后再提交');
    }

    const score = scorePersonality(dto.answers, questions);
    const runtimeCatalog = await this.catalog.getRuntimeCatalog();
    const activities = await this.activityLookup.findAllBasics();
    const activityLegacyIds = activities.map((activity) => activity.legacyId);
    let recommendations;
    try {
      recommendations = await recommendDjLineupFromCatalog(
        score,
        this.djService,
        activityLegacyIds,
        runtimeCatalog,
        this.scheduleService,
      );
    } catch (error) {
      if (error instanceof Error && error.message === LINEUP_POOL_EMPTY) {
        throw new BadRequestException('当前暂无已官宣阵容的活动，请稍后再试');
      }
      throw error;
    }
    const recommendedEvents = await recommendEventsForPersonality(
      recommendations,
      this.activityLookup,
      this.scheduleService,
    );
    const narrative = buildPersonalityNarrative(
      score,
      recommendations,
      recommendedEvents,
      runtimeCatalog.typeMeta,
    );

    const result = ensurePersonalityResultIdentity({
      version: 1,
      completedAt: new Date().toISOString(),
      answers: dto.answers,
      score,
      recommendations,
      recommendedEvents,
      narrative,
    });

    await this.persistResult(actor.resolvedUserId ?? '', result);

    // Profile hints sync removed (post system removed)

    return result;
  }
}
