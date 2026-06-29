import type {
  TravelGuideFlightLeg,
  TravelGuideFlightOffer,
} from '@sync/travel-guide-contracts';
import type { RollingGoFlightSegmentRecord } from '../infra/rollinggo/rollinggo-mcp.types';

export function formatFlightLegRoute(
  segments?: RollingGoFlightSegmentRecord[],
): string {
  if (!segments?.length) return '';

  const points: string[] = [];
  for (const seg of segments) {
    const dep = seg.depAirport?.trim();
    const arr = seg.arrAirport?.trim();
    if (dep) points.push(dep);
    if (arr) points.push(arr);
  }

  const deduped = points.filter(
    (point, index) => index === 0 || point !== points[index - 1],
  );
  return deduped.join('→');
}

export function describeFlightLegStops(
  segments?: RollingGoFlightSegmentRecord[],
): string {
  if (!segments?.length) return '直飞';
  if (segments.some((seg) => Boolean(seg.stopCities?.trim()))) return '经停';
  if (segments.length > 1) return `${segments.length - 1}次中转`;
  return '直飞';
}

export function isOutboundDirect(
  fromSegments?: RollingGoFlightSegmentRecord[],
): boolean {
  if (!fromSegments?.length || fromSegments.length !== 1) return false;
  return !fromSegments.some((seg) => Boolean(seg.stopCities?.trim()));
}

/** 解析 RollingGo 航段时间为 HH:mm（支持 2026-07-04 10:30 / 202607041030 等格式）。 */
export function formatFlightSegmentTime(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const value = raw.trim();

  const colonMatch = value.match(/(\d{1,2}):(\d{2})/);
  if (colonMatch) {
    return `${colonMatch[1]!.padStart(2, '0')}:${colonMatch[2]}`;
  }

  const compact = value.match(/\d{12,14}$/);
  if (compact) {
    const digits = compact[0]!;
    return `${digits.slice(-4, -2)}:${digits.slice(-2)}`;
  }

  return undefined;
}

export function formatFlightLegSchedule(
  segments?: RollingGoFlightSegmentRecord[],
): {
  depTime?: string;
  arrTime?: string;
  flightNumbers: string[];
} {
  if (!segments?.length) {
    return { flightNumbers: [] };
  }

  const first = segments[0]!;
  const last = segments[segments.length - 1]!;
  const flightNumbers = segments
    .map((seg) => seg.flightNumber?.trim())
    .filter((num): num is string => Boolean(num));

  return {
    depTime: formatFlightSegmentTime(first.depTime),
    arrTime: formatFlightSegmentTime(last.arrTime),
    flightNumbers,
  };
}

export function buildTravelGuideFlightLeg(
  segments?: RollingGoFlightSegmentRecord[],
): TravelGuideFlightLeg {
  const schedule = formatFlightLegSchedule(segments);
  const route = formatFlightLegRoute(segments);
  const depAirport = segments?.[0]?.depAirport?.trim();
  const arrAirport = segments?.[segments.length - 1]?.arrAirport?.trim();

  return {
    route,
    depAirport,
    arrAirport,
    depTime: schedule.depTime,
    arrTime: schedule.arrTime,
    stopsLabel: describeFlightLegStops(segments),
    ...(schedule.flightNumbers.length
      ? { flightNumbers: schedule.flightNumbers }
      : {}),
  };
}

export function buildTravelGuideFlightOffer(input: {
  fromSegments?: RollingGoFlightSegmentRecord[];
  retSegments?: RollingGoFlightSegmentRecord[];
  pricePerAdult: number;
  currency?: string;
  cabinLabel?: string;
}): TravelGuideFlightOffer | null {
  const outbound = buildTravelGuideFlightLeg(input.fromSegments);
  if (!outbound.route) return null;

  const currency = input.currency?.toUpperCase() === 'USD' ? 'USD' : 'CNY';
  const returnLeg = input.retSegments?.length
    ? buildTravelGuideFlightLeg(input.retSegments)
    : undefined;

  return {
    pricePerAdult: Math.round(input.pricePerAdult),
    currency,
    outbound,
    ...(returnLeg?.route ? { return: returnLeg } : {}),
    ...(input.cabinLabel ? { cabinLabel: input.cabinLabel } : {}),
  };
}

function formatLegTimeRange(leg: TravelGuideFlightLeg): string {
  if (leg.depTime && leg.arrTime) {
    return `${leg.depAirport ?? leg.route.split('→')[0] ?? ''} ${leg.depTime}→${leg.arrAirport ?? leg.route.split('→').pop() ?? ''} ${leg.arrTime}`.trim();
  }
  return leg.route;
}

export function formatFlightOfferSampleLine(input: {
  fromSegments?: RollingGoFlightSegmentRecord[];
  retSegments?: RollingGoFlightSegmentRecord[];
  priceLabel: string;
}): string {
  const offer = buildTravelGuideFlightOffer({
    fromSegments: input.fromSegments,
    retSegments: input.retSegments,
    pricePerAdult: 0,
    currency: 'CNY',
  });
  if (!offer) return '';

  const parts: string[] = [];
  parts.push(
    `去程 ${formatLegTimeRange(offer.outbound)}（${offer.outbound.stopsLabel}）`,
  );
  if (offer.return?.route) {
    parts.push(
      `返程 ${formatLegTimeRange(offer.return)}（${offer.return.stopsLabel}）`,
    );
  }

  return `${parts.join(' · ')} · 约 ${input.priceLabel}/人`;
}

export function isRollingGoFlightSampleLine(line: string): boolean {
  const trimmed = line.trim();
  return /^去程 .+（.+）( · 返程 .+（.+）)? · 约 [¥$]/.test(trimmed);
}

export function buildFlightOfferItinerary(
  fromSegments?: RollingGoFlightSegmentRecord[],
  retSegments?: RollingGoFlightSegmentRecord[],
): Array<{
  outboundRoute: string;
  returnRoute: string;
  outboundStops: string;
  returnStops: string;
  isOutboundDirect: boolean;
  /** @deprecated 兼容旧字段，勿用于展示 */
  segments: string;
  /** @deprecated 兼容旧字段，仅表示去程 */
  stops: string;
}> {
  const outboundRoute = formatFlightLegRoute(fromSegments);
  const returnRoute = formatFlightLegRoute(retSegments);
  const outboundStops = describeFlightLegStops(fromSegments);
  const returnStops = describeFlightLegStops(retSegments);

  return [
    {
      outboundRoute,
      returnRoute,
      outboundStops,
      returnStops,
      isOutboundDirect: isOutboundDirect(fromSegments),
      segments: [outboundRoute, returnRoute].filter(Boolean).join(' · '),
      stops: outboundStops,
    },
  ];
}

export function outboundTransferCount(
  fromSegments?: RollingGoFlightSegmentRecord[],
): number {
  if (!fromSegments?.length) return 0;
  if (fromSegments.some((seg) => Boolean(seg.stopCities?.trim()))) {
    return fromSegments.length;
  }
  return Math.max(0, fromSegments.length - 1);
}
