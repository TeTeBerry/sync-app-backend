/** How the request actor was resolved (REST middleware or WS handshake). */
export type ActorSource = 'jwt' | 'demo';

/**
 * Unified request identity for REST and WebSocket.
 * - JWT: `clientUserId` is token `sub`; `resolvedUserId` is the same.
 * - Demo: `clientUserId` from query/body; `resolvedUserId` maps demo clients to seed owner.
 */
export interface RequestActor {
  source: ActorSource;
  clientUserId: string;
  displayName: string;
  resolvedUserId: string;
}
