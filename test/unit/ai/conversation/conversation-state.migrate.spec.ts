import {
  migrateConversationStateFromHistory,
  enterPublishConfirmState,
} from '@src/ai/conversation';
import {
  buildPublishConfirmReply,
  PUBLISH_CONFIRM_PROMPT_MARKER,
} from '@src/ai/publish/publish-confirm.util';
import { SELF_POST_COLLECT_BODY_MARKER } from '@src/ai/publish/buddy-post-flow.util';
import type { ChatMessageDto } from '@src/shared/chat';

describe('migrateConversationStateFromHistory', () => {
  it('migrates publish_confirm with draft body from assistant marker', () => {
    const draft = '6.13 上海 3个男生';
    const messages: ChatMessageDto[] = [
      { role: 'user', content: '组队' },
      {
        role: 'assistant',
        content: buildPublishConfirmReply({
          activityLabel: '风暴',
          draftBody: draft,
          shortcutTag: '组队',
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
        content: `${PUBLISH_CONFIRM_PROMPT_MARKER}\n活动：风暴\n组队`,
      },
    ]);
    const explicit = enterPublishConfirmState({ draftBody: '组队' });
    expect(fromMigrate.flow).toBe(explicit.flow);
  });
});
