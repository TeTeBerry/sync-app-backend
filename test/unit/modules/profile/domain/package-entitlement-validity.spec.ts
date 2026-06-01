import {
  PACKAGE_ENTITLEMENT_VALIDITY_DAYS,
  addUtcDays,
  computeMapExpiresAt,
  computePackageValidUntil,
  isPackageEntitlementActive,
  resolveRecordValidUntil,
} from '@src/modules/profile/domain/event-entitlement.util';

describe('package entitlement validity (30 days from purchase)', () => {
  const purchasedAt = new Date('2026-05-01T12:00:00.000Z');

  it('validUntil is purchasedAt + 30 UTC days', () => {
    const validUntil = computePackageValidUntil(purchasedAt);
    expect(validUntil.toISOString()).toBe('2026-05-31T12:00:00.000Z');
    expect(PACKAGE_ENTITLEMENT_VALIDITY_DAYS).toBe(30);
  });

  it('mapExpiresAt is capped by validUntil when tier map exceeds package window', () => {
    const validUntil = computePackageValidUntil(purchasedAt);
    const mapExpiresAt = computeMapExpiresAt(purchasedAt, 30, validUntil);
    expect(mapExpiresAt.toISOString()).toBe(validUntil.toISOString());
  });

  it('mapExpiresAt uses tier map end when shorter than validUntil', () => {
    const validUntil = computePackageValidUntil(purchasedAt);
    const mapExpiresAt = computeMapExpiresAt(purchasedAt, 7, validUntil);
    expect(mapExpiresAt.toISOString()).toBe('2026-05-08T12:00:00.000Z');
  });

  it('isPackageEntitlementActive is false after validUntil', () => {
    const validUntil = computePackageValidUntil(purchasedAt);
    expect(
      isPackageEntitlementActive(validUntil, addUtcDays(validUntil, 1)),
    ).toBe(false);
    expect(
      isPackageEntitlementActive(
        validUntil,
        new Date(validUntil.getTime() - 1),
      ),
    ).toBe(true);
  });

  it('resolveRecordValidUntil falls back to purchasedAt + 30d', () => {
    expect(resolveRecordValidUntil({ purchasedAt }).toISOString()).toBe(
      '2026-05-31T12:00:00.000Z',
    );
    expect(
      resolveRecordValidUntil({
        purchasedAt,
        validUntil: '2026-06-15T00:00:00.000Z',
      }).toISOString(),
    ).toBe('2026-06-15T00:00:00.000Z');
  });
});
