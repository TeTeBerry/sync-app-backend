#!/usr/bin/env node
/**
 * Backfill Chinese `country` and `profile` for existing `djs` documents.
 *
 * Usage:
 *   npm run db:translate-dj-locale
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import {
  hasCjkText,
  localizeDjRecord,
  translateCountryToZh,
} from './lib/dj-locale.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const MONGO_URI =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';
const REQUEST_DELAY_MS = Number(process.env.DJ_TRANSLATE_DELAY_MS ?? 400);
const LIMIT = Number(process.env.DJ_TRANSLATE_LIMIT ?? 0);

const djSchema = new mongoose.Schema(
  {
    discogsId: { type: Number, unique: true, required: true },
    name: { type: String, required: true },
    profile: { type: String, default: '' },
    country: { type: String, default: '' },
  },
  { collection: 'djs', strict: false },
);

const Dj = mongoose.models.Dj ?? mongoose.model('Dj', djSchema);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const query = {};
  const cursor = Dj.find(query).sort({ discogsId: 1 }).cursor();
  let processed = 0;
  let updated = 0;

  for await (const doc of cursor) {
    if (LIMIT > 0 && processed >= LIMIT) break;
    processed += 1;

    const nextCountry = translateCountryToZh(doc.country ?? '');
    const needsCountry = nextCountry !== (doc.country ?? '');
    const needsProfile = Boolean(doc.profile?.trim()) && !hasCjkText(doc.profile);

    if (!needsCountry && !needsProfile) {
      continue;
    }

    const patch = { country: nextCountry };
    let profileTranslated = false;
    if (needsProfile) {
      await delay(REQUEST_DELAY_MS);
      try {
        const translatedProfile = await localizeDjRecord(
          { profile: doc.profile, country: doc.country },
          { translateProfile: true },
        ).then((item) => item.profile);
        if (translatedProfile && hasCjkText(translatedProfile)) {
          patch.profile = translatedProfile;
          profileTranslated = true;
        } else {
          console.warn('翻译失败', doc.name, '未得到中文 profile，保留原文');
        }
      } catch (error) {
        console.warn('翻译失败', doc.name, error.message ?? error);
      }
    }

    if (!needsCountry && needsProfile && !profileTranslated) {
      continue;
    }

    await Dj.updateOne({ _id: doc._id }, { $set: patch });
    updated += 1;
    const label =
      profileTranslated && needsCountry
        ? '(profile+country)'
        : profileTranslated
          ? '(profile)'
          : '(country)';
    console.log('✅', doc.name, label);
  }

  console.log(`\n🏁 完成：处理 ${processed} 条，更新 ${updated} 条`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ 失败:', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
