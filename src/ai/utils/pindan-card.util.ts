import { PindanJoinCardDto } from '../dto/chat.dto';

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
  joined?: number;
  total?: number;
  activityId?: string;
  activityLegacyId?: number;
  leaderUserId?: string;
  memberUserIds?: string[];
};

export function buildPindanCardFromDoc(
  pindan: PindanDoc,
  options: {
    userId?: string;
    activityLegacyId?: number;
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
    activityId: pindan.activityId,
    userJoined,
    isOwner,
    joined: pindan.joined,
    total: pindan.total,
  };
}
