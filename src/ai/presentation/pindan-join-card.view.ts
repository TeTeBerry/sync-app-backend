export interface PindanJoinCardView {
  legacyId: number;
  activityLegacyId?: number;
  category: 'package' | 'hotel' | 'transport';
  title: string;
  subtitle?: string;
  remark?: string;
  date: string;
  location: string;
  price: number;
  pricePerPerson?: number;
  budgetMin?: number;
  budgetMax?: number;
  budgetRangeLabel?: string;
  activityId?: string;
  userJoined?: boolean;
  isOwner?: boolean;
  joined?: number;
  total?: number;
}
