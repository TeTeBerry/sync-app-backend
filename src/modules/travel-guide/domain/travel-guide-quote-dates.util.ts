/** Infer check-in / return dates from catalog date strings like `06/13-14`. */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDays(ymd: string, delta: number): string {
  const date = new Date(`${ymd}T12:00:00`);
  date.setDate(date.getDate() + delta);
  return formatYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export { addDays };

/** Returns concrete festival bounds only when the catalog date is parseable. */
export function resolveFestivalDateWindow(
  activityDate?: string,
): { startDate: string; endDate: string } | null {
  const raw = activityDate?.trim();
  if (!raw) return null;
  const range = raw.match(/(\d{1,2})[./月](\d{1,2})\s*[-–~至]\s*(\d{1,2})/);
  const single = raw.match(/(\d{1,2})[./月](\d{1,2})/);
  const month = Number(range?.[1] ?? single?.[1]);
  const startDay = Number(range?.[2] ?? single?.[2]);
  const endDay = Number(range?.[3] ?? startDay);
  if (
    !Number.isFinite(month) ||
    !Number.isFinite(startDay) ||
    !Number.isFinite(endDay)
  ) {
    return null;
  }
  const year = resolveFestivalYear(month, startDay);
  return {
    startDate: formatYmd(year, month, startDay),
    endDate: formatYmd(year, month, endDay),
  };
}

export function recommendFestivalTravelDates(activityDate?: string): {
  recommendedDepartureDate: string;
  recommendedReturnDate: string;
} {
  const festival = resolveFestivalDateWindow(activityDate);
  if (!festival) {
    const fallback = resolveTravelGuideQuoteDates(activityDate, 2);
    return {
      recommendedDepartureDate: fallback.outboundDate,
      recommendedReturnDate:
        fallback.returnDate ?? addDays(fallback.outboundDate, 2),
    };
  }
  const candidates = [
    {
      departureDate: addDays(festival.startDate, -1),
      returnDate: addDays(festival.endDate, 1),
    },
    {
      departureDate: addDays(festival.startDate, -2),
      returnDate: addDays(festival.endDate, 1),
    },
    {
      departureDate: addDays(festival.startDate, -1),
      returnDate: addDays(festival.endDate, 2),
    },
  ];
  // Until quote comparison is enabled, favour the valid window with the least
  // time outside the festival rather than leaving generated candidates unused.
  const recommended = candidates.reduce((best, candidate) => {
    const bestExtra =
      Date.parse(best.returnDate) - Date.parse(best.departureDate);
    const candidateExtra =
      Date.parse(candidate.returnDate) - Date.parse(candidate.departureDate);
    return candidateExtra < bestExtra ? candidate : best;
  });
  return {
    recommendedDepartureDate: recommended.departureDate,
    recommendedReturnDate: recommended.returnDate,
  };
}

function resolveFestivalYear(
  month: number,
  day: number,
  now = new Date(),
): number {
  const year = now.getFullYear();
  const candidate = new Date(`${year}-${pad2(month)}-${pad2(day)}T12:00:00`);
  if (candidate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
    return year + 1;
  }
  return year;
}

export function resolveTravelGuideQuoteDates(
  activityDate?: string,
  accommodationNights = 2,
): { outboundDate: string; returnDate?: string } {
  const raw = activityDate?.trim();
  const now = new Date();

  if (raw) {
    const range = raw.match(/(\d{1,2})[./月](\d{1,2})\s*[-–~至]\s*(\d{1,2})/);
    if (range) {
      const month = Number(range[1]);
      const startDay = Number(range[2]);
      const endDay = Number(range[3]);
      if (
        Number.isFinite(month) &&
        Number.isFinite(startDay) &&
        Number.isFinite(endDay) &&
        endDay >= startDay
      ) {
        const year = resolveFestivalYear(month, startDay, now);
        const startYmd = formatYmd(year, month, startDay);
        const endYmd = formatYmd(year, month, endDay);
        return {
          outboundDate: addDays(startYmd, -1),
          returnDate: addDays(endYmd, 1),
        };
      }
    }

    const single = raw.match(/(\d{1,2})[./月](\d{1,2})/);
    if (single) {
      const month = Number(single[1]);
      const day = Number(single[2]);
      if (Number.isFinite(month) && Number.isFinite(day)) {
        const year = resolveFestivalYear(month, day, now);
        const startYmd = formatYmd(year, month, day);
        return {
          outboundDate: addDays(startYmd, -1),
          returnDate: addDays(startYmd, accommodationNights + 1),
        };
      }
    }
  }

  const fallbackStart = addDays(
    formatYmd(now.getFullYear(), now.getMonth() + 1, now.getDate()),
    14,
  );
  return {
    outboundDate: fallbackStart,
    returnDate: addDays(fallbackStart, accommodationNights + 1),
  };
}
