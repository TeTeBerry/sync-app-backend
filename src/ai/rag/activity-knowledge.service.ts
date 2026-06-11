import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../modules/activity/activity.service';
import { ChromaService } from '../../infra/chroma/chroma.service';
import { KNOWLEDGE_DOCUMENTS } from '../../infra/chroma/knowledge.seed';
import {
  catalogDateToIso,
  extractIsoDateFromText,
  extractYearFromText,
} from './activity-date.util';

export interface ResolvedActivityDate {
  eventDate: string;
  source: 'knowledge' | 'catalog' | 'rag';
  label?: string;
}

@Injectable()
export class ActivityKnowledgeService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly chromaService: ChromaService,
  ) {}

  /** 从知识库文档 + 活动 catalog + Chroma RAG 推断默认演出日期 */
  async resolveDefaultEventDate(
    activityCode: string,
    activityKeyword?: string,
  ): Promise<ResolvedActivityDate | null> {
    const code = activityCode.toLowerCase().trim();
    if (!code) return null;

    const yearHint =
      extractYearFromText(activityKeyword) ??
      extractYearFromText(
        KNOWLEDGE_DOCUMENTS.find((doc) => doc.metadata?.code === code)
          ?.pageContent,
      );

    for (const doc of KNOWLEDGE_DOCUMENTS) {
      if (doc.metadata?.code !== code) continue;
      const eventDate = extractIsoDateFromText(doc.pageContent);
      if (eventDate) {
        return {
          eventDate,
          source: 'knowledge',
          label: doc.pageContent.slice(0, 48),
        };
      }
    }

    if (this.chromaService.isEnabled() && activityKeyword?.trim()) {
      const ragDocs = await this.chromaService.query(
        `${activityKeyword} ${code} 演出日期`,
        2,
      );
      for (const doc of ragDocs) {
        if (doc.metadata?.code && doc.metadata.code !== code) continue;
        const eventDate = extractIsoDateFromText(doc.pageContent);
        if (eventDate) {
          return {
            eventDate,
            source: 'rag',
            label: doc.pageContent.slice(0, 48),
          };
        }
      }
    }

    const activity = await this.activityService.findByCode(code);
    if (!activity?.date) return null;

    const catalogYear =
      yearHint ?? extractYearFromText(activity.name) ?? undefined;
    const eventDate = catalogDateToIso(activity.date, catalogYear);
    if (!eventDate) return null;

    return {
      eventDate,
      source: 'catalog',
      label: activity.date,
    };
  }
}
