import {
  AGENT_MAIN_PATH_TOOL_NAMES,
  isAgentMainPathToolName,
  resolveAgentToolsForBinding,
} from '@src/ai/agent/agent-main-path-tools.util';

describe('agent-main-path-tools.util', () => {
  it('lists ten main-path tools', () => {
    expect(AGENT_MAIN_PATH_TOOL_NAMES).toHaveLength(10);
    expect(AGENT_MAIN_PATH_TOOL_NAMES).toContain('query_dj_info');
    expect(AGENT_MAIN_PATH_TOOL_NAMES).toContain('get_festival_info');
    expect(AGENT_MAIN_PATH_TOOL_NAMES).toContain('post_confirm_publish');
  });

  it('recognizes main-path tool names', () => {
    expect(isAgentMainPathToolName('query_dj_info')).toBe(true);
    expect(isAgentMainPathToolName('get_festival_info')).toBe(true);
    expect(isAgentMainPathToolName('personality_test_open')).toBe(false);
  });

  it('resolves tools by activity binding', () => {
    expect(resolveAgentToolsForBinding(false)).toContain('get_festival_info');
    expect(resolveAgentToolsForBinding(false)).not.toContain(
      'get_activity_brief',
    );
    expect(resolveAgentToolsForBinding(true)).toContain('get_activity_brief');
    expect(resolveAgentToolsForBinding(true)).not.toContain(
      'get_festival_info',
    );
  });
});
