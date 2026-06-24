/** How the request actor was resolved (REST middleware or WS handshake). */
export type ActorSource = 'jwt' | 'anonymous';

/**
 * Unified request identity for REST (and future streaming transports).
 * - JWT: `clientUserId` is token `sub`; `resolvedUserId` is the same.
 * - Anonymous: empty ids on `@Public()` routes without Bearer.
 */
export interface RequestActor {
  source: ActorSource;
  clientUserId: string;
  displayName: string;
  resolvedUserId: string;
}
