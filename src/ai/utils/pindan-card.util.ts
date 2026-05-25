import type { PindanJoinCardView as PindanJoinCardDto } from '../presentation/pindan-join-card.view';
import { formatBudgetRangeLabel } from '../pindan/find-buddy-activity-create.util';

type PindanDoc = {
  legacyId?: number;
  title?: string;
  subtitle?: string;
  remark?: string;
  type?: string;
  date?: string;
  location?: string;
  price?: number;
  originalPrice?: number;
  budgetMin?: number;
  budgetMax?: number;
  joined?: number;
  total?: number;
  activityId?: string;
  activityLegacyId?: number;
  leaderUserId?: string;
  memberUserIds?: string[];
};

function budgetRangeFromDoc(pindan: PindanDoc): string | undefined {
  if (
    pindan.budgetMin == null &&
    pindan.budgetMax == null &&
    (pindan.price == null || pindan.price <= 0)
  ) {
    return undefined;
  }
  return formatBudgetRangeLabel({
    phase: 'browse_pindan',
    joinablePindanIds: [],
    budgetMin: pindan.budgetMin,
    budgetMax: pindan.budgetMax,
    budget: pindan.price,
  });
}

export function buildPindanCardFromDoc(
  pindan: PindanDoc,
  options: {
    userId?: string;
    activityLegacyId?: number;
    budgetRangeLabel?: string;
  } = {},
): PindanJoinCardDto {
  const category =
    pindan.type === 'package' ||
    pindan.type === 'hotel' ||
    pindan.type === 'transport'
      ? pindan.type
      : 'package';

  const userId = options.userId;
  const isOwner = Boolean(
    userId && pindan.leaderUserId && pindan.leaderUserId === userId,
  );
  const userJoined = Boolean(
    isOwner ||
      (userId && pindan.memberUserIds?.includes(userId)),
  );

  const pricePerPerson = pindan.price ?? 0;
  const budgetRangeLabel =
    options.budgetRangeLabel ?? budgetRangeFromDoc(pindan);

  return {
    legacyId: pindan.legacyId ?? 0,
    activityLegacyId: options.activityLegacyId ?? pindan.activityLegacyId,
    category,
    title: pindan.title ?? '拼单',
    subtitle: pindan.subtitle,
    remark: pindan.remark,
    date: pindan.date ?? '',
    location: pindan.location ?? '',
    price: pricePerPerson,
    pricePerPerson,
    budgetMin: pindan.budgetMin,
    budgetMax: pindan.budgetMax,
    budgetRangeLabel,
    activityId: pindan.activityId,
    userJoined,
    isOwner,
    joined: pindan.joined,
    total: pindan.total,
  };
}
