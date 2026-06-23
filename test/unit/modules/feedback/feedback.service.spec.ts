import { toRequestActor } from '@src/common/auth/actor-query.util';
import { FeedbackService } from '@src/modules/feedback/feedback.service';

describe('FeedbackService', () => {
  const feedbackModel = {
    create: jest.fn(),
  };

  const wechatContentSecurity = {
    assertTextSafe: jest.fn().mockResolvedValue(undefined),
  };

  let service: FeedbackService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FeedbackService(
      feedbackModel as never,
      wechatContentSecurity as never,
    );
  });

  it('creates feedback and returns id', async () => {
    (feedbackModel.create as jest.Mock).mockResolvedValue({ _id: 'fb-1' });

    const result = await service.submit(
      { content: '  活动页加载很慢，希望优化  ' },
      toRequestActor('demo-mia'),
    );

    expect(result).toEqual({ ok: true, id: 'fb-1' });
    expect(wechatContentSecurity.assertTextSafe).toHaveBeenCalledWith(
      '活动页加载很慢，希望优化',
    );
    expect(feedbackModel.create).toHaveBeenCalledWith({
      userId: 'demo-mia',
      content: '活动页加载很慢，希望优化',
      type: 'general',
    });
  });
});
