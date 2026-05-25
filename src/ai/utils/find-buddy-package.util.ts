import type {
  FindBuddyPackageOption,
  FindBuddyState,
} from '../conversation/conversation-state.types';
import type { LlmFindBuddyVisionResult } from '../parser/llm-slot-parser.types';

function normalizeDate(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const match = raw.trim().match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (!match) return raw.trim();
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function sanitizePackageOptions(
  raw?: LlmFindBuddyVisionResult['packageOptions'] | null,
): FindBuddyPackageOption[] {
  if (!raw?.length) return [];

  return raw
    .map(item => {
      const packagePrice =
        item.packagePrice != null && item.packagePrice > 0
          ? Math.round(item.packagePrice)
          : undefined;
      const packageName =
        item.packageName?.trim() ||
        item.duration?.trim() ||
        undefined;
      const eventDate = normalizeDate(item.eventDate);
      const duration = item.duration?.trim() || undefined;

      if (!packagePrice && !packageName && !eventDate) {
        return null;
      }

      const option: FindBuddyPackageOption = {
        packageName,
        packagePrice,
        eventDate,
        duration,
      };
      return option;
    })
    .filter((item): item is FindBuddyPackageOption => item != null);
}

export function formatPackageOptionLine(
  option: FindBuddyPackageOption,
  index: number,
): string {
  const parts: string[] = [`${index + 1}.`];
  const label =
    option.packageName ??
    option.duration ??
    (option.packagePrice ? `¥${option.packagePrice}` : '套餐');
  parts.push(label);
  if (option.packagePrice) {
    parts.push(`¥${option.packagePrice}`);
  }
  if (option.eventDate) {
    parts.push(`（${option.eventDate}）`);
  }
  return parts.join(' ');
}

export function buildFindBuddyPickPackageReply(fb: FindBuddyState): string {
  const options = fb.packageOptions ?? [];
  const lines = options.map((option, index) =>
    formatPackageOptionLine(option, index),
  );

  return [
    '这张海报上有多个套餐，请先选择你要的套餐：',
    '',
    ...lines,
    '',
    '请回复序号（如「1」）或价格（如「1080」）进行选择。',
  ].join('\n');
}

export function parsePackageSelection(
  input: string,
  options: FindBuddyPackageOption[],
): number | null {
  const trimmed = input.trim();
  if (!trimmed || options.length < 2) return null;

  if (/^\d{3,5}$/.test(trimmed)) {
    const price = parseInt(trimmed, 10);
    const priceMatches = options
      .map((option, index) =>
        option.packagePrice === price ? index : -1,
      )
      .filter(index => index >= 0);
    if (priceMatches.length === 1) return priceMatches[0];
  }

  const indexMatch = trimmed.match(/^第?\s*([1-9]\d*)\s*个?$|^([1-9]\d*)$/);
  const indexRaw = indexMatch?.[1] ?? indexMatch?.[2];
  if (indexRaw) {
    const idx = parseInt(indexRaw, 10) - 1;
    if (idx >= 0 && idx < options.length) return idx;
  }

  const prices = trimmed
    .match(/\d{3,5}/g)
    ?.map(value => parseInt(value, 10)) ?? [];
  for (const price of prices) {
    const matches = options
      .map((option, index) =>
        option.packagePrice === price ? index : -1,
      )
      .filter(index => index >= 0);
    if (matches.length === 1) return matches[0];
  }

  const normalizedInput = trimmed.replace(/\s+/g, '');
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const blobs = [option.packageName, option.duration]
      .filter(Boolean)
      .map(value => value!.replace(/\s+/g, ''));
    if (blobs.some(blob => blob && normalizedInput.includes(blob))) {
      return i;
    }
  }

  if (/3\s*天\s*2\s*晚|3天2晚/.test(trimmed)) {
    const idx = options.findIndex(option =>
      /3\s*天\s*2\s*晚|3天2晚/.test(
        `${option.packageName ?? ''}${option.duration ?? ''}`,
      ),
    );
    if (idx >= 0) return idx;
  }

  if (/4\s*天\s*3\s*晚|4天3晚/.test(trimmed)) {
    const idx = options.findIndex(option =>
      /4\s*天\s*3\s*晚|4天3晚/.test(
        `${option.packageName ?? ''}${option.duration ?? ''}`,
      ),
    );
    if (idx >= 0) return idx;
  }

  return null;
}

export function applySelectedPackage(
  fb: FindBuddyState,
  option: FindBuddyPackageOption,
  selectedIndex: number,
): FindBuddyState {
  const packageName =
    option.packageName ??
    option.duration ??
    fb.packageName;

  return {
    ...fb,
    selectedPackageIndex: selectedIndex,
    packageOptions: fb.packageOptions,
    packageName,
    packagePrice: option.packagePrice ?? fb.packagePrice,
    eventDate: option.eventDate ?? fb.eventDate,
  };
}

export function resolvePackageOptionsPhase(
  state: FindBuddyState,
  visionOptions: FindBuddyPackageOption[],
): FindBuddyState {
  const options =
    visionOptions.length >= 2
      ? visionOptions
      : state.packageOptions?.length
        ? state.packageOptions
        : visionOptions;

  if (options.length >= 2) {
    return {
      ...state,
      packageOptions: options,
      phase: 'pick_package',
      packagePrice: undefined,
      packageName: state.packageName,
      eventDate: state.eventDate,
    };
  }

  if (options.length === 1) {
    return {
      ...applySelectedPackage(state, options[0], 0),
      packageOptions: undefined,
      phase: state.phase === 'pick_package' ? 'pick_activity' : state.phase,
    };
  }

  if (state.phase === 'pick_package' && !options.length) {
    return { ...state, phase: 'pick_activity' };
  }

  return state;
}
