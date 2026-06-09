import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Dj, DjDocument } from '../../database/schemas/dj.schema';
import type { DjCatalogItem, DjSearchResult } from './dj.types';
import { matchLineupArtistToCatalog } from './lineup-name-match.util';

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 30;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toCatalogItem(doc: DjDocument | Dj): DjCatalogItem {
  return {
    discogsId: doc.discogsId,
    name: doc.name,
    realName: doc.realName,
    profile: doc.profile,
    genres: doc.genres ?? [],
    styles: doc.styles ?? [],
    country: doc.country,
    thumbnail: doc.thumbnail,
    representativeWorks: doc.representativeWorks ?? [],
  };
}

@Injectable()
export class DjService {
  constructor(
    @InjectModel(Dj.name) private readonly djModel: Model<DjDocument>,
  ) {}

  async findByDiscogsId(discogsId: number): Promise<DjCatalogItem | null> {
    if (!Number.isFinite(discogsId) || discogsId <= 0) {
      return null;
    }
    const doc = await this.djModel.findOne({ discogsId }).lean().exec();
    return doc ? toCatalogItem(doc) : null;
  }

  async searchByName(
    keyword: string,
    options?: { limit?: number; skip?: number },
  ): Promise<DjSearchResult> {
    const trimmed = keyword.trim();
    if (!trimmed) {
      return { items: [], total: 0, limit: 0, skip: 0 };
    }

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const skip = Math.max(options?.skip ?? 0, 0);
    const pattern = new RegExp(escapeRegex(trimmed), 'i');
    const filter = {
      $or: [{ name: pattern }, { realName: pattern }],
    };

    const [items, total] = await Promise.all([
      this.djModel
        .find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.djModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => toCatalogItem(item)),
      total,
      limit,
      skip,
    };
  }

  async loadCatalog(): Promise<DjCatalogItem[]> {
    const docs = await this.djModel.find({}).lean().exec();
    return docs.map((doc) => toCatalogItem(doc));
  }

  /** Map lineup `artistName` → Discogs catalog item (B2B / alias aware). */
  async lookupForLineupArtists(
    artistNames: string[],
  ): Promise<Map<string, DjCatalogItem>> {
    const unique = [
      ...new Set(artistNames.map((name) => name.trim()).filter(Boolean)),
    ];
    if (!unique.length) {
      return new Map();
    }

    const catalog = await this.loadCatalog();
    const result = new Map<string, DjCatalogItem>();
    for (const name of unique) {
      const match = matchLineupArtistToCatalog(name, catalog);
      if (match) {
        result.set(name, match);
      }
    }
    return result;
  }

  async searchByStyles(
    styles: string[],
    options?: { limit?: number; skip?: number },
  ): Promise<DjSearchResult> {
    const normalized = [
      ...new Set(
        styles.map((style) => style.trim()).filter((style) => style.length > 0),
      ),
    ];
    if (!normalized.length) {
      return { items: [], total: 0, limit: 0, skip: 0 };
    }

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const skip = Math.max(options?.skip ?? 0, 0);
    const pattern = new RegExp(
      normalized.map((style) => escapeRegex(style)).join('|'),
      'i',
    );
    const filter = {
      $or: [{ styles: pattern }, { genres: pattern }],
    };

    const [items, total] = await Promise.all([
      this.djModel
        .find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.djModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => toCatalogItem(item)),
      total,
      limit,
      skip,
    };
  }
}
