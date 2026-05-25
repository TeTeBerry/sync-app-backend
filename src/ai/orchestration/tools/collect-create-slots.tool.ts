import type { ReplyContext } from '../../handler-pipeline';
import type { AgentTool } from '../agent-tool.types';

/**
 * No-op tool that signals the agent should collect pindan creation slots.
 * Actual slot collection happens in the conversation state service.
 */
export class CollectCreateSlotsTool implements AgentTool {
  readonly name = 'findBuddy.collectCreateSlots';

  async execute(_ctx: ReplyContext, args?: Record<string, unknown>) {
    return {
      stage: 'collect_create_pindan',
      mode: String(args?.mode ?? 'incremental'),
    };
  }
}
