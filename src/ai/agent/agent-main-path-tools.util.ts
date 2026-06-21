/** Tools exposed to the prep-tab Agent LLM (main path only). */
export const AGENT_MAIN_PATH_TOOL_NAMES = [
  'query_dj_info',
  'get_activity_brief',
  'get_festival_info',
  'post_start_collect',
  'post_submit',
  'post_confirm_publish',
  'travel_guide_collect_slots',
  'travel_guide_generate',
  'itinerary_collect_and_generate',
  'itinerary_generate',
] as const;

export type AgentMainPathToolName = (typeof AGENT_MAIN_PATH_TOOL_NAMES)[number];

const MAIN_PATH_TOOL_NAME_SET = new Set<string>(AGENT_MAIN_PATH_TOOL_NAMES);

export function isAgentMainPathToolName(name: string): boolean {
  return MAIN_PATH_TOOL_NAME_SET.has(name.trim());
}

/** Unbound: catalog lookup; bound: current activity brief. */
const BOUND_ONLY_TOOL_NAMES = new Set(['get_activity_brief']);

export function resolveAgentToolsForBinding(activityBound: boolean): string[] {
  return AGENT_MAIN_PATH_TOOL_NAMES.filter((name) => {
    if (activityBound) {
      return name !== 'get_festival_info';
    }
    return !BOUND_ONLY_TOOL_NAMES.has(name);
  });
}
