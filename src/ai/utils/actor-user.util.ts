import {
  DEMO_OWNER_USER_ID,
  isDemoOwnerClient,
} from '../../common/utils/demo-owner.util';

export function resolveActorUserId(
  userId?: string,
  authorName?: string,
): string {
  const uid = userId?.trim();
  if (isDemoOwnerClient(uid, authorName)) {
    return DEMO_OWNER_USER_ID;
  }
  return uid || DEMO_OWNER_USER_ID;
}
