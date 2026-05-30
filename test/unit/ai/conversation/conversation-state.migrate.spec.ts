import {
  migrateConversationStateFromHistory,
  enterPublishConfirmState,
} from '@src/ai/conversation';
import { RECOMMEND_GATE_MARKER } from '@src/ai/gate/recommend-gate.util';
import {
  buildPublishConfirmReply,
  PUBLISH_CONFIRM_PROMPT_MARKER,
} from '@src/ai/publish/publish-confirm.util';
import { SELF_POST_COLLECT_BODY_MARKER } from '@src/ai/gate/recommend-gate.util';
import type { ChatMessageDto } from '@src/ai/presentation/chat-message.dto';

describe('migrateConversationStateFromHistory', () => {
  it('migrates recommend_gate from assistant marker', () => {
    const messages: ChatMessageDto[] = [
      { role: 'user', content: '帮我dd' },
      {
        role: 'assistant',
        content: `${RECOMMEND_GATE_MARKER}\n找到 2 条`,
      },
    ];
    const state = migrateConversationStateFromHistory(messages);
    expect(state.flow).toBe('recommend_gate');
  });

  it('migrates publish_confirm with draft body from assistant marker', () => {
    const draft = 'cpdd三个男生';
    const messages: ChatMessageDto[] = [
      { role: 'user', content: '组队' },
      {
        role: 'assistant',
        content: buildPublishConfirmReply({
          activityLabel: '风暴',
          draftBody: draft,
          shortcutTag: '组队队友',
        }),
      },
    ];
    const state = migrateConversationStateFromHistory(messages);
    expect(state.flow).toBe('publish_confirm');
    expect(state.publishDraft?.draftBody).toBe(draft);
  });

  it('migrates collect_post_body from assistant marker', () => {
    const messages: ChatMessageDto[] = [
      {
        role: 'assistant',
        content: `${SELF_POST_COLLECT_BODY_MARKER}\n请填写`,
      },
    ];
    const state = migrateConversationStateFromHistory(messages);
    expect(state.flow).toBe('collect_post_body');
  });

  it('returns idle when no recognizable marker', () => {
    const messages: ChatMessageDto[] = [
      { role: 'assistant', content: '你好，需要什么帮助？' },
    ];
    expect(migrateConversationStateFromHistory(messages).flow).toBe('idle');
  });

  it('matches persisted publish_confirm shape', () => {
    const fromMigrate = migrateConversationStateFromHistory([
      {
        role: 'assistant',
        content: `${PUBLISH_CONFIRM_PROMPT_MARKER}\n活动：风暴\n找搭子`,
      },
    ]);
    const explicit = enterPublishConfirmState({ draftBody: '找搭子' });
    expect(fromMigrate.flow).toBe(explicit.flow);
  });
});
