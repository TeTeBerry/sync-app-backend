import { isActivityBriefIntent } from '../utils/activity-brief-intent.util';
import { isHomeFestivalShortcutInput } from '../utils/festival-shortcut.util';
import type { ResolvedChatIntent } from '../intent/chat-intent.types';

export function inferExpectedAgentTools(
  input: string,
  legacyIntent: ResolvedChatIntent,
  activityLegacyId?: number,
): string[] {
  if (legacyIntent.kind === 'dj_info') {
    return ['query_dj_info'];
  }

  if (
    legacyIntent.kind === 'quick_reply' &&
    isHomeFestivalShortcutInput(input.trim())
  ) {
    return ['get_festival_info'];
  }

  if (
    legacyIntent.kind === 'quick_reply' &&
    activityLegacyId != null &&
    isActivityBriefIntent(input)
  ) {
    return ['get_activity_brief'];
  }

  return [];
}

export function compareAgentShadow(params: {
  input: string;
  legacyIntent: ResolvedChatIntent;
  activityLegacyId?: number;
  agentToolsUsed: string[];
}): { expectedTools: string[]; intentToolMatch: boolean } {
  const expectedTools = inferExpectedAgentTools(
    params.input,
    params.legacyIntent,
    params.activityLegacyId,
  );

  if (!expectedTools.length) {
    return {
      expectedTools,
      intentToolMatch: params.agentToolsUsed.length === 0,
    };
  }

  const intentToolMatch = expectedTools.some((tool) =>
    params.agentToolsUsed.includes(tool),
  );

  return { expectedTools, intentToolMatch };
}
