import { ForbiddenException } from '@nestjs/common';
import { TripPlanService } from '@src/modules/trip-plan/trip-plan.service';

describe('TripPlanService member management', () => {
  const owner = { resolvedUserId: 'owner-1', source: 'jwt' as const };
  const member = { resolvedUserId: 'member-1', source: 'jwt' as const };

  function createDoc() {
    return {
      _id: 'trip-1',
      activityLegacyId: 1001,
      ownerId: owner.resolvedUserId,
      memberIds: [owner.resolvedUserId, member.resolvedUserId],
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
    };
  }

  function createService(doc = createDoc()) {
    const model = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
    return { service: new TripPlanService(model as never), model, doc };
  }

  it('allows only the owner to remove a non-owner member', async () => {
    const { service, doc } = createService();

    const result = await service.removeMember(
      'trip-1',
      member.resolvedUserId,
      owner as never,
    );

    expect(doc.memberIds).toEqual([owner.resolvedUserId]);
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(result.memberIds).toEqual([owner.resolvedUserId]);
  });

  it('keeps removed members out of activity lists', async () => {
    const { service, model } = createService();

    await service.listByActivity(1001, member as never);

    expect(model.find).toHaveBeenCalledWith({
      activityLegacyId: 1001,
      memberIds: member.resolvedUserId,
    });
  });

  it('blocks removed members from direct trip access', async () => {
    const doc = createDoc();
    doc.memberIds = [owner.resolvedUserId];
    const { service } = createService(doc);

    await expect(
      service.getById('trip-1', member as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not allow removing the owner', async () => {
    const { service } = createService();

    await expect(
      service.removeMember('trip-1', owner.resolvedUserId, owner as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a non-owner member to leave', async () => {
    const doc = createDoc();
    const { service } = createService(doc);

    const result = await service.leave('trip-1', member as never);

    expect(doc.memberIds).toEqual([owner.resolvedUserId]);
    expect(result.memberIds).toEqual([owner.resolvedUserId]);
  });

  it('blocks owner from leaving', async () => {
    const { service } = createService();

    await expect(
      service.leave('trip-1', owner as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('TripPlanService share token', () => {
  const owner = { resolvedUserId: 'owner-1', source: 'jwt' as const };
  const joiner = { resolvedUserId: 'joiner-1', source: 'jwt' as const };

  function createJoinDoc() {
    const token = 'share-token-1';
    return {
      _id: 'trip-1',
      activityLegacyId: 1001,
      ownerId: owner.resolvedUserId,
      memberIds: [owner.resolvedUserId],
      shareToken: token,
      shareTokenExpiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
    };
  }

  function createServiceForToken(doc = createJoinDoc()) {
    const model = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      }),
    };
    return { service: new TripPlanService(model as never), doc };
  }

  it('keeps share token after first join so owner can continue inviting', async () => {
    const { service, doc } = createServiceForToken();
    const tokenBefore = doc.shareToken;

    await service.joinByToken(tokenBefore!, joiner as never);

    expect(doc.memberIds).toEqual([
      owner.resolvedUserId,
      joiner.resolvedUserId,
    ]);
    expect(doc.shareToken).toBe(tokenBefore);
    expect(doc.shareTokenExpiresAt).toBeTruthy();
  });

  it('overwrites share token when owner regenerates invite', async () => {
    const doc = createJoinDoc();
    const { service } = createServiceForToken(doc);
    const previousToken = doc.shareToken;

    await service.generateShareToken('trip-1', owner as never);

    expect(doc.shareToken).toBeTruthy();
    expect(doc.shareToken).not.toBe(previousToken);
    expect(doc.shareTokenExpiresAt).toBeTruthy();
  });

  it('rejects join when share token is expired', async () => {
    const doc = createJoinDoc();
    doc.shareTokenExpiresAt = new Date(Date.now() - 60_000);
    const { service } = createServiceForToken(doc);

    await expect(
      service.joinByToken(doc.shareToken!, joiner as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
