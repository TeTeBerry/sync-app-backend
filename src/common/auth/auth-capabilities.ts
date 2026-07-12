/**
 * Centralized Raven / Festival Squad capability checks.
 * Prefer these helpers over raw `emailVerifiedAt` checks in controllers.
 */

export type AuthCapabilities = {
  canCreateSquadProfile: boolean;
  canEditSquadProfile: boolean;
  canBrowseMatches: boolean;
  canSendConnectionRequest: boolean;
  canViewSentRequests: boolean;
  canViewReceivedRequests: boolean;
  canManageSquadVisibility: boolean;
  canUseMessaging: boolean;
  canSharePhoneNumber: boolean;
  canUsePayments: boolean;
  canCreatePaymentRequests: boolean;
  canConfirmAaTransfers: boolean;
  canPublishBookingDetails: boolean;
  canAccessSensitiveTravelDetails: boolean;
  canAccessRoommateVerification: boolean;
};

export type CapabilityKey = keyof AuthCapabilities;

export function buildAuthCapabilities(
  emailVerifiedAt: Date | string | null | undefined,
): AuthCapabilities {
  const verified = emailVerifiedAt != null;
  return {
    canCreateSquadProfile: true,
    canEditSquadProfile: true,
    canBrowseMatches: true,
    canSendConnectionRequest: true,
    canViewSentRequests: true,
    canViewReceivedRequests: true,
    canManageSquadVisibility: true,
    canUseMessaging: verified,
    canSharePhoneNumber: verified,
    canUsePayments: verified,
    canCreatePaymentRequests: verified,
    canConfirmAaTransfers: verified,
    canPublishBookingDetails: verified,
    canAccessSensitiveTravelDetails: verified,
    canAccessRoommateVerification: verified,
  };
}

export function hasCapability(
  caps: AuthCapabilities,
  key: CapabilityKey,
): boolean {
  return caps[key] === true;
}

export function assertCapability(
  caps: AuthCapabilities,
  key: CapabilityKey,
  message = 'This action requires a verified email.',
): void {
  if (!hasCapability(caps, key)) {
    const error = Object.assign(new Error(message), {
      statusCode: 403,
      code: 'capability_denied',
      capability: key,
    });
    throw error;
  }
}
