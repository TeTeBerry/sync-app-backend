import {
  AGENT_MAIN_PATH_TOOL_NAMES,
  isAgentMainPathToolName,
} from '@src/ai/agent/agent-main-path-tools.util';

describe('agent-main-path-tools.util', () => {
  it('lists nine main-path tools', () => {
    expect(AGENT_MAIN_PATH_TOOL_NAMES).toHaveLength(9);
    expect(AGENT_MAIN_PATH_TOOL_NAMES).toContain('query_dj_info');
    expect(AGENT_MAIN_PATH_TOOL_NAMES).toContain('post_confirm_publish');
  });

  it('recognizes main-path tool names', () => {
    expect(isAgentMainPathToolName('query_dj_info')).toBe(true);
    expect(isAgentMainPathToolName('get_festival_info')).toBe(false);
    expect(isAgentMainPathToolName('personality_test_open')).toBe(false);
  });
});
