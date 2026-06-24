import type { ClientActionSheet } from '@sync/chat-contracts/client-action.types';
import type {
  BuddyPostComposeCandidate,
  BuddyPostSearchParsed,
  EventDetailPost,
} from '@sync/partner-contracts';

export type SceneId =
  | 'recruit_search'
  | 'recruit_compose'
  | 'prep_nudge'
  | 'events_knowledge_search';

export type EventsActivitySearchParsed = {
  month?: number;
  year?: number;
  region?: 'domestic' | 'overseas' | 'hmt' | 'europe' | 'asia';
  area?: string;
  genre?: string;
  keywords?: string[];
  intent?: 'discover' | 'recruit' | 'travel' | 'ecosystem';
};

export type KnowledgeCardSection = {
  heading?: string;
  body: string;
};

export type KnowledgeCardLink = {
  label: string;
  activityLegacyId?: number;
};

export type KnowledgeCardPayload = {
  title?: string;
  sections: KnowledgeCardSection[];
  links?: KnowledgeCardLink[];
  sources: string[];
  aiGenerated: boolean;
};

export type SceneTrigger = 'search' | 'chip' | 'sheet_submit' | 'page_enter';

export interface SceneContext {
  trigger?: SceneTrigger;
  applyPreferenceRank?: boolean;
  locale?: string;
  [key: string]: unknown;
}

export interface SceneRunRequest {
  scene: SceneId;
  intent?: string;
  activityLegacyId?: number;
  input?: string;
  context?: SceneContext;
}

export type InsightLineVariant = 'parsed' | 'preference' | 'knowledge';

export type SceneEffect =
  | {
      type: 'insight_line';
      text: string;
      variant?: InsightLineVariant;
      aiGenerated?: boolean;
    }
  | {
      type: 'reorder_posts';
      postIds: string[];
      items: EventDetailPost[];
      totalMatched: number;
      totalScanned: number;
      parsed?: BuddyPostSearchParsed;
    }
  | {
      type: 'prefill_query';
      query: string;
      source?: string;
    }
  | {
      type: 'prefill_form';
      fields: Record<string, unknown>;
      aiGenerated?: boolean;
    }
  | {
      type: 'candidates';
      items: BuddyPostComposeCandidate[];
      aiGenerated: true;
    }
  | {
      type: 'open_sheet';
      sheet: ClientActionSheet;
      mode?: 'prompt' | 'open';
    }
  | {
      type: 'inline_card';
      payload: Record<string, unknown>;
    }
  | {
      type: 'knowledge_card';
      card: KnowledgeCardPayload;
    }
  | {
      type: 'filter_activities';
      activityLegacyIds: number[];
      totalMatched: number;
      parsed?: EventsActivitySearchParsed;
    };

export interface SceneRunResponse {
  effects: SceneEffect[];
  disclaimer?: string;
}
