import { ChatService } from '@src/modules/chat/chat.service';

describe('ChatService.getSessionMessages', () => {
  const chatModel = {
    findOne: jest.fn(),
  };

  const service = new ChatService(chatModel as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the latest page when before is omitted', async () => {
    chatModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        sessionId: 's1',
        history: [
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' },
          { role: 'user', content: 'c' },
        ],
        conversationState: { version: 1, flow: 'idle' },
      }),
    });

    const page = await service.getSessionMessages('s1', { limit: 2 });

    expect(page.items).toEqual([
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ]);
    expect(page.hasMore).toBe(true);
    expect(page.nextBefore).toBe(1);
    expect(page.total).toBe(3);
  });

  it('returns an older page when before cursor is provided', async () => {
    chatModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        sessionId: 's1',
        history: [
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' },
          { role: 'user', content: 'c' },
        ],
        conversationState: { version: 1, flow: 'idle' },
      }),
    });

    const page = await service.getSessionMessages('s1', {
      limit: 2,
      before: 1,
    });

    expect(page.items).toEqual([{ role: 'user', content: 'a' }]);
    expect(page.hasMore).toBe(false);
    expect(page.nextBefore).toBeUndefined();
  });
});
