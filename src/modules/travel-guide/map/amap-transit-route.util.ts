import type { DrivingRouteSummary } from './travel-guide-map.types';

export type TransitRouteStepMode = 'walking' | 'bus' | 'subway' | 'railway';

export type TransitRouteStep = {
  mode: TransitRouteStepMode;
  summary: string;
  lineName?: string;
  departureStop?: string;
  arrivalStop?: string;
  viaStops?: number;
  distanceM?: number;
  durationMin?: number;
};

export type TransitRouteSummary = DrivingRouteSummary & {
  steps: TransitRouteStep[];
  /** Human-readable lines for travel guide display */
  detailLines: string[];
};

type AmapTransitWalkingSegment = {
  distance?: string;
  duration?: string;
  steps?: Array<{ instruction?: string; distance?: string }>;
};

type AmapTransitBusLine = {
  name?: string;
  type?: string;
  distance?: string;
  duration?: string;
  departure_stop?: { name?: string };
  arrival_stop?: { name?: string };
  via_num?: string;
};

type AmapTransitSegment = {
  walking?: AmapTransitWalkingSegment;
  bus?: { buslines?: AmapTransitBusLine[] };
  railway?: { name?: string; trip?: string };
  entrance?: { name?: string };
  exit?: { name?: string };
};

type AmapTransitRouteResponse = {
  status?: string;
  route?: {
    transits?: Array<{
      duration?: string;
      distance?: string;
      segments?: AmapTransitSegment[];
    }>;
  };
};

function parsePositiveInt(value?: string): number | undefined {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return Math.round(num);
}

function classifyTransitLineMode(
  lineName: string,
  lineType?: string,
): TransitRouteStepMode {
  const blob = `${lineName} ${lineType ?? ''}`;
  if (/地铁|轨道交通|轻轨/.test(blob)) return 'subway';
  if (/铁路|高铁|动车|火车|城际/.test(blob)) return 'railway';
  return 'bus';
}

function formatWalkingStep(
  walking: AmapTransitWalkingSegment,
  entranceName?: string,
  exitName?: string,
  position: 'start' | 'middle' | 'end' = 'middle',
): TransitRouteStep | null {
  const distanceM = parsePositiveInt(walking.distance);
  const durationMin = parsePositiveInt(walking.duration);
  const distanceLabel =
    distanceM != null && distanceM > 0
      ? distanceM >= 1000
        ? `约 ${(distanceM / 1000).toFixed(1)} km`
        : `约 ${distanceM} 米`
      : undefined;

  let summary: string;
  if (position === 'start' && entranceName) {
    summary = distanceLabel
      ? `步行${distanceLabel}至${entranceName}`
      : `步行至${entranceName}`;
  } else if (position === 'end' && exitName) {
    summary = distanceLabel
      ? `从${exitName}出站后步行${distanceLabel}至会场`
      : `从${exitName}出站后步行至会场`;
  } else {
    const instruction = walking.steps?.[0]?.instruction?.trim();
    summary = instruction
      ? instruction.replace(/<[^>]+>/g, '')
      : distanceLabel
        ? `步行${distanceLabel}`
        : '步行接驳';
  }

  return {
    mode: 'walking',
    summary,
    distanceM,
    durationMin:
      durationMin != null
        ? Math.max(1, Math.round(durationMin / 60))
        : undefined,
  };
}

function formatTransitLineStep(
  line: AmapTransitBusLine,
  entranceName?: string,
): TransitRouteStep | null {
  const lineName = line.name?.trim();
  if (!lineName) return null;

  const mode = classifyTransitLineMode(lineName, line.type);
  const from = line.departure_stop?.name?.trim();
  const to = line.arrival_stop?.name?.trim();
  const viaStops = parsePositiveInt(line.via_num);
  const durationMin = parsePositiveInt(line.duration);
  const durationLabel =
    durationMin != null && durationMin > 0
      ? `，约 ${Math.max(1, Math.round(durationMin / 60))} 分钟`
      : '';

  const stationPart =
    from && to
      ? `${from} → ${to}`
      : from
        ? `从 ${from} 上车`
        : to
          ? `至 ${to}`
          : '';

  const viaPart =
    viaStops != null && viaStops > 0
      ? `（${viaStops} 站${durationLabel}）`
      : durationLabel;

  const prefix =
    mode === 'subway' ? '乘坐' : mode === 'railway' ? '乘坐' : '乘坐公交';

  const entrancePart =
    entranceName && mode === 'subway' ? `（${entranceName}进站）` : '';

  const summary = stationPart
    ? `${prefix}${lineName}：${stationPart}${viaPart}${entrancePart}`
    : `${prefix}${lineName}${viaPart}${entrancePart}`;

  return {
    mode,
    summary,
    lineName,
    departureStop: from,
    arrivalStop: to,
    viaStops,
    durationMin:
      durationMin != null
        ? Math.max(1, Math.round(durationMin / 60))
        : undefined,
  };
}

export function parseAmapTransitRouteSteps(
  data: AmapTransitRouteResponse | null,
): TransitRouteStep[] {
  const segments = data?.route?.transits?.[0]?.segments;
  if (!data || data.status !== '1' || !segments?.length) {
    return [];
  }

  const steps: TransitRouteStep[] = [];
  let seenTransitLine = false;

  for (const segment of segments) {
    if (segment.bus?.buslines?.length) {
      const line = segment.bus.buslines[0];
      const step = formatTransitLineStep(line, segment.entrance?.name?.trim());
      if (step) {
        steps.push(step);
        seenTransitLine = true;
      }
      continue;
    }

    if (segment.railway?.name?.trim()) {
      steps.push({
        mode: 'railway',
        summary: `乘坐${segment.railway.name.trim()}${
          segment.railway.trip?.trim()
            ? `（${segment.railway.trip.trim()}）`
            : ''
        }`,
        lineName: segment.railway.name.trim(),
      });
      seenTransitLine = true;
      continue;
    }

    if (segment.walking) {
      const position =
        !seenTransitLine && steps.length === 0
          ? 'start'
          : seenTransitLine
            ? 'end'
            : 'middle';
      const step = formatWalkingStep(
        segment.walking,
        segment.entrance?.name?.trim(),
        segment.exit?.name?.trim(),
        position,
      );
      if (step) steps.push(step);
    }
  }

  return steps.filter((step) => step.summary.trim().length > 0);
}

export function formatTransitRouteDetailLines(
  steps: TransitRouteStep[],
): string[] {
  return steps.map((step) => step.summary).filter(Boolean);
}

export function buildTransitRouteSummary(
  data: AmapTransitRouteResponse | null,
): TransitRouteSummary | null {
  const transit = data?.route?.transits?.[0];
  if (!data || data.status !== '1' || !transit) return null;

  const distanceM = parsePositiveInt(transit.distance) ?? 0;
  const durationSec = parsePositiveInt(transit.duration) ?? 0;
  if (distanceM <= 0 && durationSec <= 0) return null;

  const steps = parseAmapTransitRouteSteps(data);
  const detailLines = formatTransitRouteDetailLines(steps);
  if (!detailLines.length) return null;

  return {
    distanceM,
    durationSec,
    distanceKm: Math.round((distanceM / 1000) * 10) / 10,
    durationMin: Math.max(0, Math.round(durationSec / 60)),
    steps,
    detailLines,
  };
}
