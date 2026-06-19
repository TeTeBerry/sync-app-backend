type SignupEventLike = {
  id: number;
  title: string;
  date: string;
  going: boolean;
};

function parseStartMs(date: string, title: string, now: Date): number | null {
  const trimmed = date.trim();
  if (!trimmed) return null;

  const yearHint =
    title.match(/\b(20\d{2})\b/)?.[1] ?? String(now.getFullYear());

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
    ).getTime();
  }

  const range = trimmed.match(/(\d{1,2})\/(\d{1,2})\s*[–-]\s*(\d{1,2})/);
  if (range) {
    return new Date(
      Number(yearHint),
      Number(range[1]) - 1,
      Number(range[2]),
    ).getTime();
  }

  const slash = trimmed.match(/(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    return new Date(
      Number(yearHint),
      Number(slash[1]) - 1,
      Number(slash[2]),
    ).getTime();
  }

  return null;
}

function isEnded(event: SignupEventLike, now: Date): boolean {
  const startMs = parseStartMs(event.date, event.title, now);
  if (startMs == null) return false;
  const endMs = startMs + 2 * 24 * 60 * 60 * 1000;
  return now.getTime() > endMs;
}

/** Nearest upcoming selected activity (mirrors frontend pickNextSelectedEvent). */
export function pickNextRegisteredSignupEvent(
  signupEvents: SignupEventLike[],
  now = new Date(),
): SignupEventLike | null {
  const registered = signupEvents.filter(
    (event) => event.going && !isEnded(event, now),
  );
  if (!registered.length) return null;

  return [...registered].sort((a, b) => {
    const aMs = parseStartMs(a.date, a.title, now) ?? Number.MAX_SAFE_INTEGER;
    const bMs = parseStartMs(b.date, b.title, now) ?? Number.MAX_SAFE_INTEGER;
    return aMs - bMs;
  })[0];
}
