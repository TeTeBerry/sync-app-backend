import type { ReplyContext } from '../../handler-pipeline';
import type { AgentTool } from '../agent-tool.types';

/**
 * No-op tool that just returns a collect stage marker.
 * Used as a signal in the handler pipeline; actual slot collection happens in the state service.
 */
export class CollectSlotsTool implements AgentTool {
  readonly name = 'ticket.collectSlots';

  async execute(_ctx: ReplyContext, args?: Record<string, unknown>) {
    return {
      stage: 'collect',
      mode: String(args?.mode ?? 'incremental'),
    };
  }
}
