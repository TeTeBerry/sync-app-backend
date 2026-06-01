import { JwtService } from '@nestjs/jwt';
import {
  AUTH_SESSION_EXPIRED_MESSAGE,
  classifyBearerAuth,
  extractBearerToken,
  verifyBearerActor,
} from '../../../src/common/auth/jwt-bearer.util';

describe('jwt-bearer.util', () => {
  describe('extractBearerToken', () => {
    it('parses Authorization header', () => {
      expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    });

    it('returns null when missing', () => {
      expect(extractBearerToken(undefined)).toBeNull();
    });
  });

  describe('classifyBearerAuth', () => {
    const jwtService = {
      verify: jest.fn(),
    } as unknown as JwtService;

    beforeEach(() => {
      jest.mocked(jwtService.verify).mockReset();
    });

    it('returns absent when no Authorization', () => {
      expect(classifyBearerAuth(jwtService, undefined)).toEqual({
        kind: 'absent',
      });
    });

    it('returns valid with actor for good token', () => {
      jest.mocked(jwtService.verify).mockReturnValue({
        sub: 'uid-1',
        name: 'Test User',
      });
      expect(classifyBearerAuth(jwtService, 'Bearer token')).toEqual({
        kind: 'valid',
        actor: { userId: 'uid-1', userName: 'Test User' },
      });
    });

    it('returns invalid when verify throws', () => {
      jest.mocked(jwtService.verify).mockImplementation(() => {
        throw new Error('invalid');
      });
      expect(classifyBearerAuth(jwtService, 'Bearer bad')).toEqual({
        kind: 'invalid',
      });
    });

    it('returns invalid when sub is empty', () => {
      jest.mocked(jwtService.verify).mockReturnValue({ sub: '  ', name: 'X' });
      expect(classifyBearerAuth(jwtService, 'Bearer t')).toEqual({
        kind: 'invalid',
      });
    });
  });

  describe('verifyBearerActor', () => {
    const jwtService = {
      verify: jest.fn(),
    } as unknown as JwtService;

    beforeEach(() => {
      jest.mocked(jwtService.verify).mockReset();
    });

    it('returns actor for valid token', () => {
      jest.mocked(jwtService.verify).mockReturnValue({
        sub: 'uid-1',
        name: 'Test User',
      });
      expect(verifyBearerActor(jwtService, 'Bearer token')).toEqual({
        userId: 'uid-1',
        userName: 'Test User',
      });
    });

    it('returns null for invalid token', () => {
      jest.mocked(jwtService.verify).mockImplementation(() => {
        throw new Error('invalid');
      });
      expect(verifyBearerActor(jwtService, 'Bearer bad')).toBeNull();
    });
  });

  it('exports session expired message', () => {
    expect(AUTH_SESSION_EXPIRED_MESSAGE).toBe('登录已过期，请重新登录');
  });
});
