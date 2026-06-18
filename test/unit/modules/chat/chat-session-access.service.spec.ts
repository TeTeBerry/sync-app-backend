import { ForbiddenException } from '@nestjs/common';
import type { RequestActor } from '@src/common/auth/request-actor.types';
import { ChatSessionAccessService } from '@src/modules/chat/chat-session-access.service';

const ownerActor: RequestActor = {
  source: 'jwt',
  clientUserId: 'user-1',
  displayName: 'Owner',
  resolvedUserId: 'user-1',
};

const otherActor: RequestActor = {
  source: 'jwt',
  clientUserId: 'user-2',
  displayName: 'Other',
  resolvedUserId: 'user-2',
};

describe('ChatSessionAccessService', () => {
  const service = new ChatSessionAccessService();

  it('allows owner to read session', () => {
    expect(() =>
      service.assertSessionReadable('user-1', ownerActor),
    ).not.toThrow();
  });

  it('allows read when session has no owner yet', () => {
    expect(() =>
      service.assertSessionReadable(undefined, ownerActor),
    ).not.toThrow();
  });

  it('rejects foreign session access', () => {
    expect(() => service.assertSessionReadable('user-1', otherActor)).toThrow(
      ForbiddenException,
    );
  });

  it('rejects non-jwt actor', () => {
    const anonActor: RequestActor = {
      source: 'anonymous',
      clientUserId: '',
      displayName: '',
      resolvedUserId: '',
    };

    expect(() => service.assertSessionReadable('demo', anonActor)).toThrow(
      ForbiddenException,
    );
  });
});
