import { AGENT_MAIN_PATH_TOOL_NAMES } from '@src/ai/agent/agent-main-path-tools.util';
import { ChatAgentToolRegistry } from '@src/ai/agent/chat-agent-tool.registry';

describe('ChatAgentToolRegistry', () => {
  function createRegistry(): ChatAgentToolRegistry {
    const stub = (name: string, description = name) => ({
      definition: {
        name,
        description,
        parameters: { type: 'object', properties: {} },
      },
      execute: jest.fn(),
    });

    return new ChatAgentToolRegistry(
      stub('query_dj_info') as never,
      stub('get_activity_brief') as never,
      stub('post_start_collect') as never,
      stub('post_submit') as never,
      stub('post_confirm_publish') as never,
      stub('travel_guide_collect_slots') as never,
      stub('travel_guide_generate') as never,
      stub('itinerary_collect_and_generate') as never,
      stub('itinerary_generate') as never,
    );
  }

  it('exposes only main-path tool schemas', () => {
    const registry = createRegistry();
    expect(
      registry.openAiToolSchemas().map((tool) => tool.function.name),
    ).toEqual([...AGENT_MAIN_PATH_TOOL_NAMES]);
    expect(registry.get('get_festival_info')).toBeUndefined();
    expect(registry.get('personality_test_open')).toBeUndefined();
    expect(registry.get('query_dj_info')).toBeDefined();
  });
});
