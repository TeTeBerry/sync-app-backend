import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import { loadDotEnv } from './discogs-crawl.mjs';

const DEFAULT_JWT_SECRET = 'sync-dev-jwt-secret-change-me';
const DEFAULT_SMOKE_USER_ID = 'smoke-ws-user';
const DEFAULT_SMOKE_USER_NAME = 'Smoke WS';

function base64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

/** HS256 JWT for smoke scripts (matches Nest `JwtModule` secret + payload shape). */
export function signHs256Jwt(payload, secret) {
  const header = base64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = base64urlJson(payload);
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

async function ensureSmokeUser(externalId, name) {
  const uri =
    process.env.MONGODB_URI ??
    process.env.MONGO_URI ??
    'mongodb://127.0.0.1:27017/sync-ai';

  await mongoose.connect(uri);

  const userSchema = new mongoose.Schema(
    {
      externalId: { type: String, unique: true, sparse: true },
      name: String,
      handle: String,
      location: { type: String, default: '' },
      bio: { type: String, default: '' },
      avatar: { type: String, default: '' },
      notificationsEnabled: { type: Boolean, default: true },
      privacyLevel: { type: String, default: 'public' },
      tokenVersion: { type: Number, default: 0 },
    },
    { timestamps: true, collection: 'users' },
  );

  const User =
    mongoose.models.SmokeJwtUser ??
    mongoose.model('SmokeJwtUser', userSchema);

  const doc = await User.findOneAndUpdate(
    { externalId },
    {
      $setOnInsert: {
        externalId,
        handle: `@${externalId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'smoke'}`,
        location: '',
        bio: '',
        avatar: '',
        notificationsEnabled: true,
        privacyLevel: 'public',
        tokenVersion: 0,
      },
      $set: { name },
    },
    { upsert: true, new: true },
  ).lean();

  return {
    externalId: doc.externalId,
    tokenVersion: doc.tokenVersion ?? 0,
  };
}

/**
 * Resolve a Bearer JWT for smoke tests.
 * - `SMOKE_JWT` set → use as-is
 * - else upsert `SMOKE_USER_ID` in Mongo and sign with `JWT_SECRET` + `tv`
 */
export async function resolveSmokeJwt() {
  loadDotEnv();

  const preset = process.env.SMOKE_JWT?.trim();
  if (preset) {
    return preset;
  }

  const secret = process.env.JWT_SECRET?.trim() || DEFAULT_JWT_SECRET;
  const externalId =
    process.env.SMOKE_USER_ID?.trim() || DEFAULT_SMOKE_USER_ID;
  const name = process.env.SMOKE_USER_NAME?.trim() || DEFAULT_SMOKE_USER_NAME;

  let user;
  try {
    user = await ensureSmokeUser(externalId, name);
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }

  const now = Math.floor(Date.now() / 1000);
  return signHs256Jwt(
    {
      sub: user.externalId,
      name,
      tv: user.tokenVersion,
      iat: now,
      exp: now + 60 * 60,
    },
    secret,
  );
}
