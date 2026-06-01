import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LlmService } from '../../ai/llm/llm.service';
import { KNOWLEDGE_DOCUMENTS } from '../../ai/rag/knowledge.seed';
import { RedisService } from '../../redis/redis.service';
import { ActivityService } from './activity.service';
import { UpdateActivityDto } from './dto/update-activity.dto';

const REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const REDIS_LAST_REFRESH_KEY = 'activity:catalog:last_refresh';
const DAILY_CHECK_MS = 24 * 60 * 60 * 1000;

type LlmCatalogPatch = {
  changed?: boolean;
  name?: string;
  date?: string;
  location?: string;
  image?: string;
  hot?: boolean;
  attendees?: number;
  reason?: string;
};

function knowledgeForCode(code: string): string {
  return KNOWLEDGE_DOCUMENTS.filter(
    (doc) => String(doc.metadata?.code ?? '') === code,
  )
    .map((doc) => doc.pageContent)
    .join('\n');
}

@Injectable()
export class ActivityCatalogRefreshService implements OnModuleInit {
  private readonly logger = new Logger(ActivityCatalogRefreshService.name);
  private lastRefreshAt = 0;
  private refreshInFlight = false;

  constructor(
    private readonly activityService: ActivityService,
    private readonly llmService: LlmService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.loadLastRefreshAt();
    void this.refreshIfDue();
    setInterval(() => void this.refreshIfDue(), DAILY_CHECK_MS);
  }

  async refreshIfDue(
    force = false,
  ): Promise<{ refreshed: boolean; updated: number }> {
    if (this.refreshInFlight) {
      return { refreshed: false, updated: 0 };
    }

    if (!force && Date.now() - this.lastRefreshAt < REFRESH_INTERVAL_MS) {
      return { refreshed: false, updated: 0 };
    }

    if (!this.llmService.enabled) {
      this.logger.warn('LLM disabled, skip activity catalog refresh');
      return { refreshed: false, updated: 0 };
    }

    this.refreshInFlight = true;
    try {
      const updated = await this.refreshCatalog();
      this.lastRefreshAt = Date.now();
      await this.persistLastRefreshAt(this.lastRefreshAt);
      this.logger.log(`Activity catalog refresh completed, updated=${updated}`);
      return { refreshed: true, updated };
    } catch (error) {
      this.logger.warn(
        `Activity catalog refresh failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { refreshed: false, updated: 0 };
    } finally {
      this.refreshInFlight = false;
    }
  }

  private async refreshCatalog(): Promise<number> {
    const activities = await this.activityService.findAll();
    let updated = 0;

    for (const activity of activities) {
      if (!activity.code || !activity.legacyId) continue;

      const knowledge = knowledgeForCode(activity.code);
      const patch = await this.llmService.invokeJson<LlmCatalogPatch>(
        [
          '你是电音节活动 catalog 维护助手。',
          '根据提供的官方知识片段，核对并更新活动字段。',
          '仅在有可靠依据时标记 changed=true；无变化则 changed=false。',
          '返回 JSON：{ changed, name?, date?, location?, image?, hot?, attendees?, reason? }',
          'date 格式与现有 catalog 一致，如 06/13-14；image 必须是可公开访问的 https URL。',
        ].join('\n'),
        [
          `活动 code: ${activity.code}`,
          `当前 catalog:`,
          JSON.stringify({
            name: activity.name,
            date: activity.date,
            location: activity.location,
            image: activity.image,
            hot: activity.hot,
            attendees: activity.attendees,
          }),
          '',
          '官方知识片段:',
          knowledge || '（暂无额外知识，保持现有字段）',
        ].join('\n'),
      );

      if (!patch?.changed) continue;

      const dto: UpdateActivityDto = {};
      if (patch.name?.trim()) dto.name = patch.name.trim();
      if (patch.date !== undefined) dto.date = patch.date.trim();
      if (patch.location !== undefined) dto.location = patch.location.trim();
      if (patch.image !== undefined) dto.image = patch.image.trim();
      if (typeof patch.hot === 'boolean') dto.hot = patch.hot;
      if (typeof patch.attendees === 'number' && patch.attendees >= 0) {
        dto.attendees = patch.attendees;
      }

      if (Object.keys(dto).length === 0) continue;

      await this.activityService.updateActivity(activity.legacyId, dto);
      updated += 1;
    }

    return updated;
  }

  private async loadLastRefreshAt(): Promise<void> {
    const raw = await this.redisService.getCacheValue(REDIS_LAST_REFRESH_KEY);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      this.lastRefreshAt = parsed;
    }
  }

  private async persistLastRefreshAt(timestamp: number): Promise<void> {
    await this.redisService.setCacheValue(
      REDIS_LAST_REFRESH_KEY,
      String(timestamp),
    );
  }
}
