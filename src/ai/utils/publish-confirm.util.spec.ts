import {
  isAwaitingPublishConfirmation,
  isPublishConfirmIntent,
  PUBLISH_CONFIRM_PROMPT_MARKER,
} from './publish-confirm.util';

describe('publish-confirm.util', () => {
  it('detects publish confirm intents', () => {
    expect(isPublishConfirmIntent('确认发布')).toBe(true);
    expect(isPublishConfirmIntent('确认')).toBe(true);
    expect(isPublishConfirmIntent('组队队友')).toBe(false);
  });

  it('detects awaiting confirmation from prior assistant turn', () => {
    const messages = [
      { role: 'user' as const, content: '组队队友' },
      {
        role: 'assistant' as const,
        content: `${PUBLISH_CONFIRM_PROMPT_MARKER}\n请确认`,
      },
      { role: 'user' as const, content: '确认发布' },
    ];

    expect(isAwaitingPublishConfirmation(messages)).toBe(true);
  });
});
