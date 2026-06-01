import { NotFoundException } from '@nestjs/common';
import { toRequestActor } from '@src/common/auth/actor-query.util';
import { NotificationService } from '@src/modules/notification/notification.service';

describe('NotificationService', () => {
  const createModel = () => ({
    create: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
    insertMany: jest.fn(),
  });

  let model: ReturnType<typeof createModel>;
  let service: NotificationService;

  beforeEach(() => {
    model = createModel();
    service = new NotificationService(model as never);
  });

  it('skips anonymous notification creation', async () => {
    const result = await service.createNotification({
      userId: 'anonymous',
      type: 'system',
      title: 't',
      body: 'b',
    });
    expect(result).toBeNull();
    expect(model.create).not.toHaveBeenCalled();
  });

  it('marks notification as read for owner', async () => {
    model.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'n1',
        userId: 'u1',
        type: 'interaction',
        title: 't',
        body: 'b',
        read: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    });

    const result = await service.markRead('n1', toRequestActor('u1'));
    expect(result.read).toBe(true);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'n1', userId: 'u1' },
      { $set: { read: true } },
      { new: true },
    );
  });

  it('throws when deleting missing notification', async () => {
    model.deleteOne.mockResolvedValue({ deletedCount: 0 });
    await expect(
      service.deleteOne('missing', toRequestActor('u1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes one notification for owner', async () => {
    model.deleteOne.mockResolvedValue({ deletedCount: 1 });
    await expect(
      service.deleteOne('n1', toRequestActor('u1')),
    ).resolves.toEqual({ ok: true });
    expect(model.deleteOne).toHaveBeenCalledWith({ _id: 'n1', userId: 'u1' });
  });

  it('clears all notifications for user', async () => {
    model.deleteMany.mockResolvedValue({ deletedCount: 5 });
    await expect(service.clearAll(toRequestActor('u1'))).resolves.toEqual({
      ok: true,
    });
    expect(model.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
  });
});
