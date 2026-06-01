import { ConflictException } from '@nestjs/common';
import { toRequestActor } from '@src/common/auth/actor-query.util';
import { ReportService } from '@src/modules/report/report.service';

describe('ReportService', () => {
  const reportModel = {
    create: jest.fn(),
  };

  let service: ReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportService(reportModel as never);
  });

  it('creates a report and returns id', async () => {
    (reportModel.create as jest.Mock).mockResolvedValue({ _id: 'report-1' });

    const result = await service.submit(
      {
        targetType: 'post',
        targetId: 'post-1',
        targetUserId: 'author-1',
        category: 'ads',
      },
      toRequestActor('demo-mia'),
    );

    expect(result).toEqual({ ok: true, id: 'report-1' });
    expect(reportModel.create).toHaveBeenCalledWith({
      reporterUserId: 'demo-mia',
      targetType: 'post',
      targetId: 'post-1',
      targetUserId: 'author-1',
      category: 'ads',
      reason: undefined,
    });
  });

  it('throws conflict on duplicate report', async () => {
    (reportModel.create as jest.Mock).mockRejectedValue({ code: 11000 });

    await expect(
      service.submit(
        { targetType: 'post', targetId: 'post-1', category: 'vulgar' },
        toRequestActor('demo-mia'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('resolves demo owner reporter id', async () => {
    (reportModel.create as jest.Mock).mockResolvedValue({ _id: 'r2' });

    await service.submit(
      { targetType: 'post', targetId: 'p', category: 'scalper' },
      toRequestActor('demo-zara', 'Zara Chen'),
    );

    expect(reportModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ reporterUserId: 'demo-zara' }),
    );
  });
});
