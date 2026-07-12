import {
  buildAuthCapabilities,
  hasCapability,
} from '@src/common/auth/auth-capabilities';
import {
  emailExternalId,
  isValidEmail,
  normalizeEmail,
} from '@src/common/auth/email.util';

describe('email.util', () => {
  it('normalizes domain and validates', () => {
    expect(normalizeEmail('  A@Example.COM ')).toEqual({
      email: 'A@example.com',
      emailNormalized: 'a@example.com',
    });
    expect(isValidEmail('a@example.com')).toBe(true);
    expect(isValidEmail('bad')).toBe(false);
  });

  it('builds opaque external ids (not raw email)', () => {
    const id = emailExternalId('a@example.com');
    expect(id.startsWith('email_')).toBe(true);
    expect(id.includes('@')).toBe(false);
    expect(emailExternalId('a@example.com')).toBe(id);
  });
});

describe('auth capabilities', () => {
  it('blocks future-sensitive actions for unverified users', () => {
    const caps = buildAuthCapabilities(null);
    expect(caps.canCreateSquadProfile).toBe(true);
    expect(caps.canSendConnectionRequest).toBe(true);
    expect(hasCapability(caps, 'canUseMessaging')).toBe(false);
    expect(hasCapability(caps, 'canUsePayments')).toBe(false);
    expect(hasCapability(caps, 'canAccessSensitiveTravelDetails')).toBe(false);
  });

  it('allows restricted capabilities when verified', () => {
    const caps = buildAuthCapabilities(new Date());
    expect(caps.canUseMessaging).toBe(true);
    expect(caps.canUsePayments).toBe(true);
  });
});
