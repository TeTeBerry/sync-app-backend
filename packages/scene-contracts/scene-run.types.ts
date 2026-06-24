import type { ClientActionSheet } from '@sync/chat-contracts/client-action.types';
import type {
  BuddyPostComposeCandidate,
  BuddyPostSearchParsed,
  EventDetailPost,
} from '@sync/partner-contracts';

export type SceneId = 'recruit_search' | 'recruit_compose' | 'prep_nudge';

export type SceneTrigger = 'search' | 'chip' | 'sheet_submit' | 'page_enter';

export interface SceneContext {
  trigger?: SceneTrigger;
  applyPreferenceRank?: boolean;
  [key: string]: unknown;
}

export interface SceneRunRequest {
  scene: SceneId;
  intent?: string;
  activityLegacyId?: number;
  input?: string;
  context?: SceneContext;
}

export type InsightLineVariant = 'parsed' | 'preference';

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
    };

export interface SceneRunResponse {
  effects: SceneEffect[];
  disclaimer?: string;
}
