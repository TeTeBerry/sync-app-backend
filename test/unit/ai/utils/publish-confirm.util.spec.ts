import {
  buildPublishConfirmReply,
  extractDraftBodyFromPublishConfirmContent,
  extractDraftTagsFromPublishConfirmContent,
  isAwaitingPublishConfirmation,
  isPublishConfirmIntent,
  PUBLISH_CONFIRM_PROMPT_MARKER,
} from '@src/ai/publish/publish-confirm.util';
import { enterPublishConfirmState } from '@src/ai/conversation';

describe('publish-confirm.util', () => {
  it('detects publish confirm intents', () => {
    expect(isPublishConfirmIntent('确认发布')).toBe(true);
    expect(isPublishConfirmIntent('确认')).toBe(true);
    expect(isPublishConfirmIntent('组队发帖')).toBe(false);
  });

  it('does not detect awaiting confirmation from marker without persisted state', () => {
    const messages = [
      { role: 'user' as const, content: '组队发帖' },
      {
        role: 'assistant' as const,
        content: `${PUBLISH_CONFIRM_PROMPT_MARKER}\n请确认`,
      },
      { role: 'user' as const, content: '确认发布' },
    ];

    expect(isAwaitingPublishConfirmation(messages)).toBe(false);
  });

  it('extracts draft paragraph from publish confirm reply', () => {
    const draft = '6.13 上海 3个男生';
    const content = buildPublishConfirmReply({
      activityLabel: '风暴电音节',
      draftBody: draft,
      shortcutTag: '自己发帖',
    });
    expect(extractDraftBodyFromPublishConfirmContent(content)).toBe(draft);
  });

  it('embeds and extracts draft tags in publish confirm reply', () => {
    const draft = '13A区有姐妹吗';
    const content = buildPublishConfirmReply({
      activityLabel: '风暴电音节',
      draftBody: draft,
      shortcutTag: '组队',
      draftTags: ['#13号A区', '#女生'],
    });
    expect(extractDraftTagsFromPublishConfirmContent(content)).toEqual([
      '#13号A区',
      '#女生',
    ]);
  });

  it('detects awaiting confirmation from persisted conversation state', () => {
    const messages = [{ role: 'user' as const, content: '确认发布' }];
    expect(
      isAwaitingPublishConfirmation(
        messages,
        enterPublishConfirmState({ activityLegacyId: 1, draftBody: '组队' }),
      ),
    ).toBe(true);
  });
});
