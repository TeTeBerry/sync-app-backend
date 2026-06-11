export type LiveInfoCategoryId =
  | 'entry_crowd'
  | 'toilet_queue'
  | 'water_queue'
  | 'smoke_drink'
  | 'sound_level'
  | 'stage_view';

export const LIVE_INFO_CATEGORY_IDS: LiveInfoCategoryId[] = [
  'entry_crowd',
  'toilet_queue',
  'water_queue',
  'smoke_drink',
  'sound_level',
  'stage_view',
];

export type LiveInfoZone = {
  id: string;
  label: string;
};

export type LiveInfoSummaryRow = {
  categoryId: LiveInfoCategoryId;
  score: number;
};

export type LiveInfoFeedItem = {
  id: string;
  userName: string;
  avatar?: string;
  authorOnSiteVerified?: boolean;
  zoneTag: string;
  zoneLabel: string;
  timeLabel: string;
  ratings: { categoryId: LiveInfoCategoryId; score: number }[];
  remark?: string;
  likes: number;
  liked?: boolean;
};

export type LiveInfoCertStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type LiveInfoViewerState = {
  isCertified: boolean;
  certStatus: LiveInfoCertStatus;
  certExpiryLabel: string;
  wristbandImageUrl?: string;
  rejectReason?: string;
};

export type LiveInfoSnapshot = {
  activityLegacyId: number;
  eventDate: string;
  zones: LiveInfoZone[];
  viewer: LiveInfoViewerState;
  summary: LiveInfoSummaryRow[];
  certCount: number;
  feed: LiveInfoFeedItem[];
};

export type LiveInfoFeedFilters = {
  zoneTag?: string;
  categoryId?: LiveInfoCategoryId;
  certifiedOnly?: boolean;
};

export type SubmitLiveInfoWristbandPayload = {
  imageUrl: string;
};

export type SubmitLiveInfoWristbandRejectCode = 'duplicate_image';

export type SubmitLiveInfoWristbandResult = {
  ok: boolean;
  viewer: LiveInfoViewerState;
  message?: string;
  code?: SubmitLiveInfoWristbandRejectCode;
};

export type PublishLiveInfoPayload = {
  zoneTag: string;
  ratings: { categoryId: LiveInfoCategoryId; score: number }[];
  remark?: string;
};
