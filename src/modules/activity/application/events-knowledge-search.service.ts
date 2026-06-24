import { Injectable, Optional } from '@nestjs/common';
import type {
  EventsActivitySearchParsed,
  KnowledgeCardPayload,
  KnowledgeCardSection,
} from '@sync/scene-contracts';
import { Document } from '@langchain/core/documents';
import { ChromaService } from '../../../infra/chroma/chroma.service';
import { LlmService } from '../../../infra/llm/llm.service';
import { LineupCatalogService } from '../../itinerary/lineup-catalog.service';
import { ActivityLookupService } from '../activity-lookup.service';
import type { ActivityLookupRecord } from '../ports/activity-lookup.port';
import {
  mergeArtistKnowledgeDocuments,
  mergeArtistMatchedActivities,
  resolveArtistKnowledgeFallback,
  shouldPreferLineupForArtistQuery,
} from '../utils/events-knowledge-artist-fallback.util';
import { resolveFestivalKnowledgeFallback } from '../utils/events-knowledge-festival-fallback.util';
import {
  filterActivitiesByParsedSearch,
  formatEventsActivitySearchParsedSummary,
  parseEventsActivitySearchQuery,
} from '../utils/events-activity-search.util';
import { mergeChromaActivityHints } from '../utils/events-knowledge-chroma.util';
import {
  appendCuratedChromaSections,
  rankKnowledgeDocumentsForIntent,
  resolveKnowledgeQueryTopics,
} from '../utils/events-knowledge-query.util';
import {
  buildFestivalCompareKnowledgeCard,
  enrichParsedForCompare,
  resolveCompareActivities,
} from '../utils/events-festival-compare.util';
import {
  shouldUseLlmCompareIntro,
  shouldUseLlmKnowledgeCard,
} from '../utils/events-knowledge-llm-gate.util';

export type EventsKnowledgeSearchResult = {
  parsed: EventsActivitySearchParsed;
  parsedSummary: string | null;
  matchedActivities: ActivityLookupRecord[];
  knowledgeCard: KnowledgeCardPayload | null;
};

const KNOWLEDGE_LLM_TIMEOUT_MS = 8_000;

@Injectable()
export class EventsKnowledgeSearchService {
  constructor(
    private readonly activityLookup: ActivityLookupService,
    @Optional() private readonly chromaService?: ChromaService,
    @Optional() private readonly llmService?: LlmService,
    @Optional() private readonly lineupCatalog?: LineupCatalogService,
  ) {}

  async search(
    input: string,
    locale = 'zh-CN',
  ): Promise<EventsKnowledgeSearchResult> {
    const trimmed = input.trim();
    let parsed = parseEventsActivitySearchQuery(trimmed);
    const allActivities = await this.activityLookup.findAll();
    const now = new Date();
    const upcoming = allActivities.filter((activity) => {
      const year = activity.date?.match(/^(\d{4})-/);
      if (!year) return true;
      const endYear = Number(year[1]);
      return endYear >= now.getFullYear() - 1;
    });
    const catalogPool = upcoming.length ? upcoming : allActivities;
    let matchedActivities = filterActivitiesByParsedSearch(
      catalogPool,
      parsed,
      trimmed,
    );

    let chromaDocs = await this.queryKnowledge(trimmed, parsed);

    const artistFallback = await resolveArtistKnowledgeFallback({
      query: trimmed,
      keywords: parsed.keywords,
      activityPool: allActivities,
      lineupCatalog: this.lineupCatalog,
    });
    const festivalFallback = resolveFestivalKnowledgeFallback({
      query: trimmed,
      catalogPool,
    });
    if (!chromaDocs.length && festivalFallback.docs.length) {
      chromaDocs = rankKnowledgeDocumentsForIntent(
        festivalFallback.docs,
        resolveKnowledgeQueryTopics(trimmed, parsed),
      );
    }
    chromaDocs = mergeArtistKnowledgeDocuments(chromaDocs, artistFallback.docs);

    if (
      shouldPreferLineupForArtistQuery(
        artistFallback.artistName,
        artistFallback.activities,
      )
    ) {
      matchedActivities = artistFallback.activities;
      const activityCodes = new Set(matchedActivities.map((item) => item.code));
      chromaDocs = chromaDocs.filter((doc) => {
        const topic = doc.metadata?.topic;
        const code = doc.metadata?.code;
        if (topic !== 'activity' || !code) return true;
        return activityCodes.has(String(code));
      });
    } else {
      matchedActivities = mergeChromaActivityHints(
        matchedActivities,
        chromaDocs,
        catalogPool,
      );
      matchedActivities = mergeArtistMatchedActivities(
        matchedActivities,
        artistFallback.activities,
      );
      matchedActivities = mergeArtistMatchedActivities(
        matchedActivities,
        festivalFallback.activities,
      );
    }

    parsed = enrichParsedForCompare(
      trimmed,
      parsed,
      catalogPool,
      matchedActivities,
    );

    if (parsed.intent === 'compare') {
      const comparePair = resolveCompareActivities(
        trimmed,
        catalogPool,
        matchedActivities,
      );
      if (comparePair.length >= 2) {
        matchedActivities = comparePair;
      }
    }

    const parsedSummary = formatEventsActivitySearchParsedSummary(parsed);
    const knowledgeCard = await this.buildKnowledgeCard({
      query: trimmed,
      parsed,
      activities: matchedActivities,
      allActivities: catalogPool,
      chromaDocs,
      locale,
    });

    return {
      parsed,
      parsedSummary,
      matchedActivities,
      knowledgeCard,
    };
  }

  private async queryKnowledge(
    query: string,
    parsed: EventsActivitySearchParsed,
  ): Promise<Document[]> {
    if (!this.chromaService?.isEnabled()) return [];

    const topics = resolveKnowledgeQueryTopics(query, parsed);
    const docs = await this.chromaService.query(query, 8, {
      topics: topics as string[] | undefined,
    });

    return rankKnowledgeDocumentsForIntent(docs, topics).slice(0, 6);
  }

  private async buildKnowledgeCard(params: {
    query: string;
    parsed: EventsActivitySearchParsed;
    activities: ActivityLookupRecord[];
    allActivities: ActivityLookupRecord[];
    chromaDocs: Document[];
    locale: string;
  }): Promise<KnowledgeCardPayload | null> {
    if (params.parsed.intent === 'compare' && params.activities.length >= 2) {
      const intro = await this.tryLlmCompareIntro(params);
      return buildFestivalCompareKnowledgeCard({
        query: params.query,
        parsed: params.parsed,
        activities: params.activities,
        allActivities: params.allActivities,
        locale: params.locale,
        introBody: intro?.body,
        aiGenerated: intro?.aiGenerated ?? false,
      });
    }

    if (
      shouldUseLlmKnowledgeCard({
        query: params.query,
        parsed: params.parsed,
        matchedActivities: params.activities,
        chromaDocs: params.chromaDocs,
      })
    ) {
      const llmCard = await this.tryLlmKnowledgeCard(params);
      if (llmCard) return llmCard;
    }

    return this.buildTemplateKnowledgeCard(params);
  }

  private buildTemplateKnowledgeCard(params: {
    query: string;
    parsed: EventsActivitySearchParsed;
    activities: ActivityLookupRecord[];
    chromaDocs: Document[];
    locale: string;
  }): KnowledgeCardPayload | null {
    const { parsed, activities, chromaDocs, locale } = params;
    const isEn = locale.toLowerCase().startsWith('en');
    const sections: KnowledgeCardSection[] = [];
    const sources = new Set<string>(isEn ? ['SYNC catalog'] : ['SYNC 活动库']);

    if (parsed.intent === 'recruit') {
      sections.push({
        heading: isEn ? 'Looking for a crew?' : '想找同行？',
        body: isEn
          ? 'Public recruit posts live on each event detail page. Open an event below, then use AI recruit search on the feed.'
          : '公开组队招募在活动详情页的招募墙。先选一场节进入详情，再用「AI 找队」检索公开帖。',
      });
      if (activities[0]) {
        sources.add(activities[0].infoSource ?? activities[0].name);
      }
      return {
        title: isEn ? 'Festival intel' : '电音节资讯',
        sections,
        links: activities.slice(0, 3).map((activity) => ({
          label: activity.name,
          activityLegacyId: activity.legacyId,
        })),
        sources: Array.from(sources),
        aiGenerated: false,
      };
    }

    if (parsed.intent === 'ecosystem') {
      const ecosystemDocs = chromaDocs.filter(
        (doc) => doc.metadata?.topic === 'ecosystem',
      );
      const body =
        ecosystemDocs[0]?.pageContent ??
        (isEn
          ? 'Festival info apps and official mini-programs vary by event. Check the event detail page for verified dates, venue, and lineup links.'
          : '电音节相关小程序与官方号因活动而异。建议以活动详情页的档期、地点与阵容信息为准，购票请认准主办方公开渠道。');
      sections.push({
        heading: isEn ? 'Tools & channels' : '资讯与购票渠道',
        body,
      });
      for (const doc of ecosystemDocs.slice(1, 3)) {
        sections.push({ body: doc.pageContent });
      }
      sources.add(isEn ? 'Curated FAQ' : '运营整理 FAQ');
      return {
        title: isEn ? 'Festival intel' : '电音节资讯',
        sections,
        links: activities.slice(0, 3).map((activity) => ({
          label: activity.name,
          activityLegacyId: activity.legacyId,
        })),
        sources: Array.from(sources),
        aiGenerated: false,
      };
    }

    if (parsed.intent === 'travel') {
      const travelHint = chromaDocs[0]?.pageContent;
      sections.push({
        heading: isEn ? 'Travel essentials' : '出行提示',
        body:
          travelHint ??
          (isEn
            ? 'Visa, currency, and local rules depend on your passport and destination. Generate a travel guide from the event detail for tailored checklists.'
            : '签证、换汇与入境要求因护照与目的地而异。可在活动详情生成出行攻略，查看该场的证件与必备清单。'),
      });
      sources.add(isEn ? 'Public references' : '公开资料整理');
      return {
        title: isEn ? 'Festival intel' : '电音节资讯',
        sections,
        links: activities.slice(0, 3).map((activity) => ({
          label: activity.name,
          activityLegacyId: activity.legacyId,
        })),
        sources: Array.from(sources),
        aiGenerated: false,
      };
    }

    if (activities.length > 0) {
      const intro = isEn
        ? `Found ${activities.length} related event${activities.length > 1 ? 's' : ''} in the catalog.`
        : `在活动库中找到 ${activities.length} 场相关电音节。`;
      sections.push({ body: intro });

      const highlights = activities.slice(0, 8).map((activity) => {
        const date = activity.date?.trim();
        const location = activity.location?.trim() || activity.area?.trim();
        const bits = [activity.name];
        if (date) bits.push(date);
        if (location) bits.push(location);
        return bits.join(' · ');
      });
      sections.push({
        heading: isEn ? 'Highlights' : '相关活动',
        body: highlights.map((line) => `• ${line}`).join('\n'),
      });

      appendCuratedChromaSections({
        sections,
        chromaDocs,
        sources,
        isEn,
      });

      for (const activity of activities.slice(0, 3)) {
        if (activity.infoSource) sources.add(activity.infoSource);
      }

      return {
        title: isEn ? 'Festival intel' : '电音节资讯',
        sections,
        links: activities.slice(0, 8).map((activity) => ({
          label: activity.name,
          activityLegacyId: activity.legacyId,
        })),
        sources: Array.from(sources),
        aiGenerated: false,
      };
    }

    if (chromaDocs.length > 0) {
      appendCuratedChromaSections({
        sections,
        chromaDocs,
        sources,
        isEn,
      });
      if (sections.length === 0) {
        sections.push({
          body: chromaDocs
            .slice(0, 3)
            .map((doc) => doc.pageContent)
            .join('\n\n'),
        });
      }
      sources.add(isEn ? 'Activity knowledge base' : '活动知识库');
      return {
        title: isEn ? 'Festival intel' : '电音节资讯',
        sections,
        sources: Array.from(sources),
        aiGenerated: false,
      };
    }

    return {
      title: isEn ? 'Festival intel' : '电音节资讯',
      sections: [
        {
          body: isEn
            ? 'No exact match in the catalog. Try a festival name, city, or month — e.g. "EDC Korea" or "July Europe techno".'
            : '暂未在活动库中找到精确匹配。可试试节名、城市或月份，例如「EDC Korea」「7 月欧洲 techno」。',
        },
      ],
      sources: Array.from(sources),
      aiGenerated: false,
    };
  }

  private async tryLlmCompareIntro(params: {
    query: string;
    parsed: EventsActivitySearchParsed;
    activities: ActivityLookupRecord[];
    locale: string;
  }): Promise<{ body: string; aiGenerated: true } | null> {
    if (!this.llmService?.enabled) return null;
    if (!shouldUseLlmCompareIntro(params.parsed, params.query)) return null;

    const isEn = params.locale.toLowerCase().startsWith('en');
    const [left, right] = params.activities;
    const system = isEn
      ? 'Write a one-sentence intro for a festival comparison card. Reply JSON only: {"intro":"..."}. No ticketing promises, no buddy matching.'
      : '为电音节对比卡写一句导语。只输出 JSON：{"intro":"..."}。不卖票、不撮合找队友。';

    const user = [
      `Query: ${params.query}`,
      `Left: ${left.name} (${left.location ?? left.area ?? ''})`,
      `Right: ${right.name} (${right.location ?? right.area ?? ''})`,
    ].join('\n');

    const result = await this.llmService.invokeJson<{ intro?: string }>(
      system,
      user,
      KNOWLEDGE_LLM_TIMEOUT_MS,
      { reasoningEffort: 'no_think' },
    );

    const intro = result?.intro?.trim();
    if (!intro) return null;

    return { body: intro, aiGenerated: true };
  }

  private async tryLlmKnowledgeCard(params: {
    query: string;
    parsed: EventsActivitySearchParsed;
    activities: ActivityLookupRecord[];
    chromaDocs: Document[];
    locale: string;
  }): Promise<KnowledgeCardPayload | null> {
    if (!this.llmService?.enabled) return null;
    if (params.parsed.intent === 'recruit') return null;

    const isEn = params.locale.toLowerCase().startsWith('en');
    const activityLines = params.activities
      .slice(0, 6)
      .map((activity) => {
        const bits = [`${activity.name} (id=${activity.legacyId})`];
        if (activity.date) bits.push(`date=${activity.date}`);
        if (activity.location) bits.push(`location=${activity.location}`);
        return bits.join(', ');
      })
      .join('\n');
    const knowledgeLines = params.chromaDocs
      .map((doc) => doc.pageContent)
      .join('\n\n');

    const system = isEn
      ? 'You summarize EDM festival catalog search results. Reply with JSON only: {"title":"...","sections":[{"heading":"optional","body":"..."}],"sources":["..."]}. No ticketing promises, no buddy matching, no contact info. Keep 2-3 short sections.'
      : '你是电音节资讯助手，根据活动库与知识片段写摘要。只输出 JSON：{"title":"...","sections":[{"heading":"可选","body":"..."}],"sources":["来源1"]}。不卖票、不撮合找队友、不提供联系方式。2～3 段，简洁可读。';

    const user = [
      `Query: ${params.query}`,
      `Parsed: ${JSON.stringify(params.parsed)}`,
      `Activities:\n${activityLines || '(none)'}`,
      `Knowledge:\n${knowledgeLines || '(none)'}`,
    ].join('\n\n');

    const result = await this.llmService.invokeJson<{
      title?: string;
      sections?: KnowledgeCardSection[];
      sources?: string[];
    }>(system, user, KNOWLEDGE_LLM_TIMEOUT_MS, { reasoningEffort: 'no_think' });

    if (!result?.sections?.length) return null;

    return {
      title: result.title ?? (isEn ? 'Festival intel' : '电音节资讯'),
      sections: result.sections
        .map((section) => ({
          heading: section.heading?.trim() || undefined,
          body: section.body?.trim() ?? '',
        }))
        .filter((section) => section.body.length > 0),
      links: params.activities.slice(0, 4).map((activity) => ({
        label: activity.name,
        activityLegacyId: activity.legacyId,
      })),
      sources:
        result.sources?.filter(Boolean) ??
        (isEn ? ['SYNC catalog'] : ['SYNC 活动库']),
      aiGenerated: true,
    };
  }
}
