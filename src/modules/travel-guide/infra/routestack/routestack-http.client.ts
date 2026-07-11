import { createHmac, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  RouteStackDestinationTypeFilter,
  RouteStackDestinationsResponse,
  RouteStackSearchHotelsRequest,
  RouteStackSearchHotelsResponse,
  RouteStackHotelDetailsRequest,
  RouteStackHotelDetailsResponse,
} from './routestack.types';

type RouteStackEnvelope = {
  success?: boolean;
  message?: string | null;
  code?: number | string;
};

@Injectable()
export class RouteStackHttpClient {
  private readonly logger = new Logger(RouteStackHttpClient.name);
  private cachedToken: string | null = null;
  private cachedTokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return (
      this.config.get<boolean>('routestack.enabled') === true &&
      Boolean(this.config.get<string>('routestack.apiKey')?.trim()) &&
      Boolean(this.config.get<string>('routestack.apiSecret')?.trim())
    );
  }

  async searchDestinations(input: {
    query: string;
    type?: RouteStackDestinationTypeFilter;
  }): Promise<RouteStackDestinationsResponse> {
    return this.postJson<RouteStackDestinationsResponse>(
      '/mcp/hotel/search-destinations',
      {
        query: input.query.trim(),
        ...(input.type ? { type: input.type } : {}),
      },
    );
  }

  async searchHotels(
    body: RouteStackSearchHotelsRequest,
  ): Promise<RouteStackSearchHotelsResponse> {
    return this.postJson<RouteStackSearchHotelsResponse>(
      '/mcp/hotel/search-hotels',
      body as unknown as Record<string, unknown>,
    );
  }

  async getHotelDetails(
    body: RouteStackHotelDetailsRequest,
  ): Promise<RouteStackHotelDetailsResponse> {
    return this.postJson<RouteStackHotelDetailsResponse>(
      '/mcp/hotel/get-hotel-details',
      body as unknown as Record<string, unknown>,
    );
  }

  private get baseUrl(): string {
    const raw =
      this.config.get<string>('routestack.baseUrl')?.trim() ||
      'https://mcp.routestack.ai';
    return raw.replace(/\/+$/, '');
  }

  private get timeoutMs(): number {
    return this.config.get<number>('routestack.timeoutMs') ?? 20_000;
  }

  private async getBearerToken(forceRefresh = false): Promise<string> {
    const apiKey = this.config.get<string>('routestack.apiKey')?.trim();
    const apiSecret = this.config.get<string>('routestack.apiSecret')?.trim();
    if (!apiKey || !apiSecret) {
      throw new Error(
        'ROUTESTACK_API_KEY and ROUTESTACK_API_SECRET are required for partner-token auth',
      );
    }

    if (
      !forceRefresh &&
      this.cachedToken &&
      Date.now() < this.cachedTokenExpiresAt
    ) {
      return this.cachedToken;
    }

    // Official RouteStack partner-token flow:
    // HMAC payload = "apiKey:timestamp:nonce" → Authorization: Bearer <token>
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = randomUUID();
    const hmac = createHmac('sha256', apiSecret)
      .update(`${apiKey}:${timestamp}:${nonce}`)
      .digest('base64url');

    const url = `${this.baseUrl}/mcp/auth/partner-token`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, hmac, timestamp, nonce }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `RouteStack partner-token failed (${response.status}): ${text.slice(0, 240)}`,
      );
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(
        `RouteStack partner-token response was not JSON: ${text}`,
      );
    }

    const token = typeof data.token === 'string' ? data.token.trim() : '';
    if (!token) {
      throw new Error(
        `RouteStack partner-token missing token field: ${text.slice(0, 240)}`,
      );
    }

    this.cachedToken = token;
    // Docs say expiresIn "24h"; refresh early.
    this.cachedTokenExpiresAt = Date.now() + 20 * 60 * 60 * 1000;
    return token;
  }

  private clearCachedToken(): void {
    this.cachedToken = null;
    this.cachedTokenExpiresAt = 0;
  }

  private async postJson<T extends RouteStackEnvelope>(
    path: string,
    body: Record<string, unknown>,
    retriedAuth = false,
  ): Promise<T> {
    const token = await this.getBearerToken(retriedAuth);
    const url = `${this.baseUrl}${path}`;
    this.logger.log(`RouteStack POST ${path}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    if (response.status === 401 && !retriedAuth) {
      this.logger.warn(
        `RouteStack ${path} unauthorized — refreshing partner token`,
      );
      this.clearCachedToken();
      return this.postJson(path, body, true);
    }
    if (!response.ok) {
      throw new Error(
        `RouteStack ${path} HTTP ${response.status}: ${text.slice(0, 240)}`,
      );
    }

    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new Error(
        `RouteStack ${path} response was not JSON: ${text.slice(0, 240)}`,
      );
    }

    if (data.success === false) {
      const codePart =
        data.code != null && data.code !== '' ? ` code=${data.code}` : '';
      const message =
        typeof data.message === 'string' && data.message.trim()
          ? data.message.trim()
          : 'unknown error';
      throw new Error(`RouteStack ${path} failed:${codePart} ${message}`);
    }
    return data;
  }
}
