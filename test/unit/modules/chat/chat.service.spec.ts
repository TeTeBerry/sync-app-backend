import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Chat } from '@src/database/schemas/chat.schema';
import {
  CHAT_LLM_CONTEXT_TURNS,
  ChatService,
} from '@src/modules/chat/chat.service';

describe('ChatService history (strategy A)', () => {
  let service: ChatService;
  const findOne = jest.fn();
  const findOneAndUpdate = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    findOneAndUpdate.mockResolvedValue({});

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getModelToken(Chat.name),
          useValue: {
            findOne,
            findOneAndUpdate,
            deleteOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ChatService);
  });

  it('merges stored and incoming with overlap', () => {
    const merged = service.mergeChatHistory(
      [
        { role: 'user', content: '组队' },
        { role: 'assistant', content: '几个人？' },
      ],
      [
        { role: 'assistant', content: '几个人？' },
        { role: 'user', content: '2人' },
      ],
    );

    expect(merged).toEqual([
      { role: 'user', content: '组队' },
      { role: 'assistant', content: '几个人？' },
      { role: 'user', content: '2人' },
    ]);
  });

  it('truncates merged history to recent turns', () => {
    const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (let index = 0; index < CHAT_LLM_CONTEXT_TURNS + 2; index += 1) {
      turns.push({ role: 'user', content: `u${index}` });
      turns.push({ role: 'assistant', content: `a${index}` });
    }

    const truncated = service.truncateToRecentTurns(
      turns,
      CHAT_LLM_CONTEXT_TURNS,
    );
    expect(truncated.filter((message) => message.role === 'user')).toHaveLength(
      CHAT_LLM_CONTEXT_TURNS,
    );
    expect(truncated[0]).toEqual({ role: 'user', content: 'u2' });
  });
});
