import { Injectable } from '@nestjs/common';
import { resolveActivityStructuredDates } from '../../../common/utils/activity-date.util';
import { ActivityLookupService } from '../../activity/activity-lookup.service';

export type RavenFestivalWeather = {
  date: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationProbability: number;
  weatherCode: number;
};

type OpenMeteoForecast = {
  daily?: {
    time?: unknown;
    temperature_2m_min?: unknown;
    temperature_2m_max?: unknown;
    precipitation_probability_max?: unknown;
    weather_code?: unknown;
  };
};

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

@Injectable()
export class RavenFestivalWeatherService {
  constructor(private readonly activityLookup: ActivityLookupService) {}

  /**
   * A missing row is intentional: Open-Meteo only returns the upcoming forecast
   * window, and Raven should stay quiet when the festival is outside it.
   */
  async getForActivity(legacyId: number): Promise<RavenFestivalWeather | null> {
    const activity = await this.activityLookup.findByLegacyId(legacyId);
    const date = activity
      ? resolveActivityStructuredDates(activity).startDate
      : undefined;
    const latitude = activity?.latitude;
    const longitude = activity?.longitude;

    if (
      !date ||
      !isCoordinate(latitude, -90, 90) ||
      !isCoordinate(longitude, -180, 180)
    ) {
      return null;
    }

    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      daily:
        'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      forecast_days: '7',
      timezone: 'auto',
    });

    try {
      const response = await fetch(`${OPEN_METEO_FORECAST_URL}?${params}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return null;

      return selectForecastDay(
        (await response.json()) as OpenMeteoForecast,
        date,
      );
    } catch {
      // Forecast availability must never interrupt a completed journey plan.
      return null;
    }
  }
}

function isCoordinate(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function selectForecastDay(
  forecast: OpenMeteoForecast,
  festivalDate: string,
): RavenFestivalWeather | null {
  const daily = forecast.daily;
  if (!daily || !Array.isArray(daily.time)) return null;

  const index = daily.time.findIndex((value) => value === festivalDate);
  if (index < 0) return null;

  const temperatureMin = valueAt(daily.temperature_2m_min, index);
  const temperatureMax = valueAt(daily.temperature_2m_max, index);
  const precipitationProbability = valueAt(
    daily.precipitation_probability_max,
    index,
  );
  const weatherCode = valueAt(daily.weather_code, index);

  if (
    temperatureMin == null ||
    temperatureMax == null ||
    precipitationProbability == null ||
    weatherCode == null
  ) {
    return null;
  }

  return {
    date: festivalDate,
    temperatureMin,
    temperatureMax,
    precipitationProbability,
    weatherCode,
  };
}

function valueAt(values: unknown, index: number): number | null {
  if (!Array.isArray(values)) return null;
  const value = values[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
