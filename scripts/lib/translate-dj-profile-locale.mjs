import mongoose from 'mongoose';
import {
  hasCjkText,
  localizeDjRecord,
  translateCountryToZh,
} from './dj-locale.mjs';

const djSchema = new mongoose.Schema(
  {
    discogsId: { type: Number, unique: true, required: true },
    name: { type: String, required: true },
    profile: { type: String, default: '' },
    country: { type: String, default: '' },
  },
  { collection: 'djs', strict: false },
);

function getDjModel() {
  return mongoose.models.DjProfileLocale ?? mongoose.model('DjProfileLocale', djSchema);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * LLM-translate missing `profileZh` and normalize `country` on one MongoDB.
 */
export async function runTranslateDjProfileLocale(
  mongoUri,
  options = {},
) {
  const requestDelayMs = Number(options.requestDelayMs ?? process.env.DJ_TRANSLATE_DELAY_MS ?? 400);
  const limit = Number(options.limit ?? process.env.DJ_TRANSLATE_LIMIT ?? 0);

  await mongoose.connect(mongoUri);
  const Dj = getDjModel();
  const cursor = Dj.find({}).sort({ discogsId: 1 }).cursor();

  let processed = 0;
  let updated = 0;

  for await (const doc of cursor) {
    if (limit > 0 && processed >= limit) {
      break;
    }
    processed += 1;

    const nextCountry = translateCountryToZh(doc.country ?? '');
    const needsCountry = nextCountry !== (doc.country ?? '');
    const profileSource = (doc.profile ?? '').trim();
    const hasCachedZh =
      Boolean(doc.profileZh?.trim()) && doc.profileZhSource === profileSource;
    const needsProfile =
      Boolean(profileSource) && !hasCjkText(profileSource) && !hasCachedZh;

    if (!needsCountry && !needsProfile) {
      continue;
    }

    const patch = { country: nextCountry };
    let profileTranslated = false;
    if (needsProfile) {
      await delay(requestDelayMs);
      try {
        const translatedProfile = await localizeDjRecord(
          { profile: doc.profile, country: doc.country },
          { translateProfile: true },
        ).then((item) => item.profile);
        if (translatedProfile && hasCjkText(translatedProfile)) {
          patch.profileZh = translatedProfile;
          patch.profileZhSource = profileSource;
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

  await mongoose.disconnect();
  return { processed, updated };
}
