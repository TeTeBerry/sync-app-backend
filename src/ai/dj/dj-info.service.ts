import { Injectable } from '@nestjs/common';
import { DjLocaleService } from '../../modules/dj/dj-locale.service';
import { DjService } from '../../modules/dj/dj.service';
import { ItineraryScheduleService } from '../../modules/itinerary/itinerary-schedule.service';
import {
  formatArtistDiscographyReply,
  formatArtistPerformancesReply,
  formatDjListReply,
  formatDjProfileReply,
  formatLineupNotAnnouncedReply,
  lineupDjStyleLabel,
} from './dj-info-reply.util';
import { parseDjInfoQuery } from './dj-info-query.util';
import { DjInfoResolverService } from './dj-info-resolver.service';
import { buildDjInfoSuggestedReplies } from './dj-info-suggested-replies.util';
import type { DjInfoStructuredQuery } from './dj-info-structured.types';
import type { DjCatalogItem } from '../../modules/dj/dj.types';
import type { ChatMessageDto } from '../../shared/chat';

const LIST_LIMIT = 8;

@Injectable()
export class DjInfoService {
  constructor(
    private readonly djService: DjService,
    private readonly djLocaleService: DjLocaleService,
    private readonly scheduleService: ItineraryScheduleService,
    private readonly djInfoResolver: DjInfoResolverService,
  ) {}

  async answerFromStructured(
    query: DjInfoStructuredQuery,
    activityLegacyId?: number,
  ): Promise<{ replyText: string }> {
    const useLineup =
      query.scope === 'lineup' ||
      (query.scope === 'auto' &&
        activityLegacyId != null &&
        !Number.isNaN(activityLegacyId) &&
        (query.intent === 'lineup_by_style' ||
          query.intent === 'lineup_overview'));

    if (query.intent === 'similar_artists') {
      const exclude = query.referenceArtist ?? query.artistName;
      if (query.styles.length > 0) {
        return this.answerCatalogByStyle(query.styles, exclude);
      }
      if (exclude) {
        return this.answerSimilarToArtist(exclude, activityLegacyId);
      }
      return {
        replyText:
          '可以说一下你想参考哪位艺人或哪种曲风，我来帮你在艺人库里找风格相近的 DJ。',
      };
    }

    if (query.intent === 'artist_performances' && query.artistName) {
      return this.answerArtistPerformances(query.artistName, activityLegacyId);
    }

    if (query.intent === 'artist_discography' && query.artistName) {
      return this.answerArtistDiscography(query.artistName, activityLegacyId);
    }

    if (query.intent === 'artist_profile' && query.artistName) {
      return this.answerArtistProfile(query.artistName, activityLegacyId);
    }

    if (
      useLineup &&
      activityLegacyId != null &&
      !Number.isNaN(activityLegacyId) &&
      (query.intent === 'lineup_by_style' || query.intent === 'lineup_overview')
    ) {
      return this.answerLineupQuery(
        {
          kind: query.styles.length > 0 ? 'lineup_by_style' : 'lineup_overview',
          styles: query.styles,
          referenceArtist: query.referenceArtist,
        },
        activityLegacyId,
      );
    }

    if (query.intent === 'by_style' && query.styles.length > 0) {
      return this.answerCatalogByStyle(query.styles, query.referenceArtist);
    }

    if (query.artistName) {
      return this.answerArtistProfile(query.artistName, activityLegacyId);
    }

    return {
      replyText:
        '你可以问我某位 DJ 的风格，或者说「这场有哪些 Techno DJ」——我会按艺人库或当前活动阵容帮你查。',
    };
  }

  async answerFromChat(
    input: string,
    activityLegacyId?: number,
    options?: {
      messages?: ChatMessageDto[];
      toolArgs?: Record<string, unknown>;
    },
  ): Promise<{
    replyText: string;
    query: DjInfoStructuredQuery;
    suggestedReplies: string[];
  }> {
    const messages = options?.messages ?? [];
    const query = await this.djInfoResolver.resolve({
      messages,
      input,
      activityLegacyId,
      toolArgs: options?.toolArgs,
    });
    const { replyText } = await this.answerFromStructured(
      query,
      activityLegacyId,
    );
    return {
      replyText,
      query,
      suggestedReplies: buildDjInfoSuggestedReplies({
        query,
        activityLegacyId,
      }),
    };
  }

  private async answerArtistDiscography(
    artistName: string,
    activityLegacyId?: number,
  ): Promise<{ replyText: string }> {
    const catalog = await this.djService.searchByName(artistName, { limit: 3 });
    const best = await this.pickBestArtistMatch(
      artistName,
      activityLegacyId,
      catalog.items,
    );
    if (!best) {
      return {
        replyText: `没在艺人库里找到「${artistName}」，暂时无法查询代表作。`,
      };
    }

    const localized = await this.djLocaleService.localizeCatalogItem(best);
    return {
      replyText: formatArtistDiscographyReply({
        artistName: localized.name,
        works: localized.representativeWorks ?? [],
      }),
    };
  }

  private async answerArtistPerformances(
    artistName: string,
    activityLegacyId?: number,
  ): Promise<{ replyText: string }> {
    const hits = await this.scheduleService.findArtistPerformances({
      artistName,
      activityLegacyId,
    });
    const catalog = await this.djService.searchByName(artistName, { limit: 1 });
    const displayName =
      hits[0]?.artistName ?? catalog.items[0]?.name ?? artistName;

    return {
      replyText: formatArtistPerformancesReply({
        artistName: displayName,
        items: hits,
      }),
    };
  }

  private async answerArtistProfile(
    artistName: string,
    activityLegacyId?: number,
  ): Promise<{ replyText: string }> {
    const catalog = await this.djService.searchByName(artistName, { limit: 3 });
    const best = await this.pickBestArtistMatch(
      artistName,
      activityLegacyId,
      catalog.items,
    );
    if (best) {
      const profile = await this.djService.resolveProfileForDisplay(
        best.discogsId,
        best.profile,
      );
      const localized = {
        ...best,
        country: this.djLocaleService.localizeCountry(best.country),
        profile,
      };
      return { replyText: formatDjProfileReply(localized) };
    }

    if (activityLegacyId != null && !Number.isNaN(activityLegacyId)) {
      const lineupMatch = await this.findLineupArtist(
        artistName,
        activityLegacyId,
      );
      if (lineupMatch) {
        return {
          replyText: `${lineupMatch.name}\n🎧 风格：${lineupDjStyleLabel(lineupMatch)}`,
        };
      }
    }

    return {
      replyText: `没在艺人库里找到「${artistName}」。可以检查一下艺名拼写，或问「这场阵容有哪些 ${artistName} 类似的风格」。`,
    };
  }

  private async answerSimilarToArtist(
    artistName: string,
    activityLegacyId?: number,
  ): Promise<{ replyText: string }> {
    const catalog = await this.djService.searchByName(artistName, { limit: 3 });
    const best = await this.pickBestArtistMatch(
      artistName,
      activityLegacyId,
      catalog.items,
    );
    if (!best) {
      return {
        replyText: `没在艺人库里找到「${artistName}」，换个艺名或曲风试试。`,
      };
    }

    const styles =
      best.styles.length > 0 ? best.styles : best.genres.slice(0, 4);
    if (!styles.length) {
      return {
        replyText: `${best.name} 的风格标签还不完整，暂时没法推荐相近艺人。`,
      };
    }

    return this.answerCatalogByStyle(styles.slice(0, 4), best.name);
  }

  private async answerCatalogByStyle(
    styles: string[],
    excludeArtist?: string,
  ): Promise<{ replyText: string }> {
    const result = await this.djService.searchByStyles(styles, {
      limit: LIST_LIMIT + 6,
    });
    const excludeNorm = excludeArtist?.trim().toLowerCase();
    const filtered = excludeNorm
      ? result.items.filter(
          (item) => item.name.trim().toLowerCase() !== excludeNorm,
        )
      : result.items;
    const items = filtered.slice(0, LIST_LIMIT);
    const title = excludeArtist
      ? `🎧 与 ${excludeArtist} 风格相近的 DJ`
      : `🎧 ${styles.join(' / ')} 相关 DJ`;

    return {
      replyText: formatDjListReply({
        title,
        items: items.map((item) => ({
          name: item.name,
          styleLabel:
            item.styles.slice(0, 3).join(' · ') ||
            item.genres.slice(0, 3).join(' · '),
        })),
        total: filtered.length,
        truncated: filtered.length > items.length,
      }),
    };
  }

  private async answerLineupQuery(
    query: ReturnType<typeof parseDjInfoQuery>,
    activityLegacyId: number,
  ): Promise<{ replyText: string }> {
    const schedule = await this.scheduleService.getSchedule(activityLegacyId);
    let lineup = schedule.djs;

    if (query.styles.length) {
      const stylePattern = new RegExp(
        query.styles
          .map((style) => style.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|'),
        'i',
      );
      lineup = lineup.filter(
        (dj) =>
          stylePattern.test(dj.genre ?? '') ||
          stylePattern.test(dj.genreLabel ?? ''),
      );
    }

    const activityLabel = schedule.eventMeta?.trim() || '本场活动';

    if (schedule.djs.length === 0) {
      return {
        replyText: formatLineupNotAnnouncedReply(activityLabel),
      };
    }

    if (query.styles.length > 0 && lineup.length === 0) {
      return {
        replyText: `🎤 ${activityLabel} · ${query.styles.join(' / ')}\n本场阵容里暂未找到该曲风 DJ，可以换个风格试试。`,
      };
    }

    return {
      replyText: formatDjListReply({
        title:
          query.styles.length > 0
            ? `🎤 ${activityLabel} · ${query.styles.join(' / ')}`
            : `🎤 ${activityLabel} 阵容 DJ`,
        items: lineup.slice(0, LIST_LIMIT).map((dj) => ({
          name: dj.name,
          styleLabel: lineupDjStyleLabel(dj),
        })),
        total: lineup.length,
        truncated: lineup.length > LIST_LIMIT,
      }),
    };
  }

  private async pickBestArtistMatch(
    artistName: string,
    activityLegacyId: number | undefined,
    candidates: DjCatalogItem[],
  ): Promise<DjCatalogItem | null> {
    if (!candidates.length) {
      return null;
    }

    const normalized = artistName.trim().toLowerCase();
    const exact = candidates.find(
      (item) => item.name.trim().toLowerCase() === normalized,
    );
    if (exact) {
      return exact;
    }

    if (activityLegacyId != null && !Number.isNaN(activityLegacyId)) {
      const lineup = await this.scheduleService.getSchedule(activityLegacyId);
      const lineupNames = new Set(
        lineup.djs.map((dj) => dj.name.trim().toLowerCase()),
      );
      const inLineup = candidates.find((item) =>
        lineupNames.has(item.name.trim().toLowerCase()),
      );
      if (inLineup) {
        return inLineup;
      }
    }

    return candidates[0] ?? null;
  }

  private async findLineupArtist(artistName: string, activityLegacyId: number) {
    const schedule = await this.scheduleService.getSchedule(activityLegacyId);
    const normalized = artistName.trim().toLowerCase();
    return (
      schedule.djs.find((dj) => dj.name.trim().toLowerCase() === normalized) ??
      schedule.djs.find((dj) =>
        dj.name.trim().toLowerCase().includes(normalized),
      ) ??
      null
    );
  }
}
