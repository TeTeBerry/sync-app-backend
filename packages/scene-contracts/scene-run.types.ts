import type { ClientActionSheet } from './client-action.types';

export type SceneId =
  | 'lineup_dj'
  | 'festival_story'
  | 'events_knowledge_search';

export type EventsActivitySearchParsed = {
  month?: number;
  year?: number;
  region?: 'domestic' | 'overseas' | 'hmt' | 'europe' | 'asia';
  area?: string;
  genre?: string;
  keywords?: string[];
  intent?: 'discover' | 'travel' | 'ecosystem' | 'compare';
  compareActivityCodes?: [string, string];
};

export type KnowledgeCardCompareRow = {
  label: string;
  left: string;
  right: string;
};

export type KnowledgeCardComparePayload = {
  leftName: string;
  rightName: string;
  leftActivityLegacyId?: number;
  rightActivityLegacyId?: number;
  rows: KnowledgeCardCompareRow[];
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
  compare?: KnowledgeCardComparePayload;
};

export type SceneTrigger = 'search' | 'chip' | 'sheet_submit' | 'page_enter';

export interface SceneContext {
  trigger?: SceneTrigger;
  applyPreferenceRank?: boolean;
  locale?: string;
  [key: string]: unknown;
}

/** Context for `scene=lineup_dj` (AI DJ bio / intro card). */
export interface LineupDjSceneContext extends SceneContext {
  artistName: string;
  activityLegacyId: number;
  genre?: string;
  regenerate?: boolean;
}

/** Context for `scene=festival_story` (AI structured festival summary). */
export interface FestivalStorySceneContext extends SceneContext {
  activityLegacyId: number;
  regenerate?: boolean;
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
    }
  | {
      type: 'dj_bio';
      artistName: string;
      bio: string;
      genres?: string[];
      aiGenerated: true;
    }
  | {
      type: 'festival_story';
      title: string;
      sections: { heading?: string; body: string }[];
      sources: string[];
      aiGenerated: true;
    };

export interface SceneRunResponse {
  effects: SceneEffect[];
  disclaimer?: string;
}
