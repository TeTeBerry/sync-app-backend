import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { ACTIVITY_SEED } from './activity-catalog-seed-data.mjs';
import {
  getCloudBaseUploadConfig,
  getWeChatAccessToken,
  uploadBufferToCloudBase,
} from './cloudbase-upload.mjs';
import { readEnvValue } from './parse-env-file.mjs';

function maskUri(uri) {
  return uri.replace(/:[^:@/]+@/, ':***@');
}

export function buildSeedImageIndex() {
  const byFilename = new Map();
  const byCloudPath = new Map();
  for (const item of ACTIVITY_SEED) {
    const cloudPath = item.image?.trim();
    if (!cloudPath) {
      continue;
    }
    byFilename.set(path.basename(cloudPath), item);
    byCloudPath.set(cloudPath, item);
  }
  return { byFilename, byCloudPath };
}

export function resolveMongoTargets(rootDir) {
  const localOnly = process.argv.includes('--local-only');
  const cloudOnly = process.argv.includes('--cloud-only');
  const targets = [];

  const localUri =
    process.env.LOCAL_MONGODB_URI ??
    process.env.MONGODB_URI ??
    'mongodb://127.0.0.1:27017/sync-ai';

  const cloudUri =
    process.env.CLOUD_MONGODB_URI ??
    readEnvValue(path.join(rootDir, '.env.production'), 'MONGODB_URI');

  if (!cloudOnly) {
    targets.push(localUri);
  }
  if (!localOnly && cloudUri && !targets.includes(cloudUri)) {
    targets.push(cloudUri);
  }

  return targets;
}

async function updateActivityImageInDatabases(targets, legacyId, cloudPath) {
  for (const uri of targets) {
    await mongoose.connect(uri);
    await mongoose.connection.db.collection('activities').updateOne(
      { legacyId },
      { $set: { image: cloudPath, updatedAt: new Date() } },
    );
    console.log(
      `   MongoDB legacyId=${legacyId} image=${cloudPath} (${maskUri(uri)})`,
    );
    await mongoose.disconnect();
  }
}

export async function uploadActivityImage({
  seed,
  buffer,
  envId,
  accessToken,
  targets,
  dryRun = false,
}) {
  const cloudPath = seed.image;
  console.log(`⬆️  ${seed.code}: ${cloudPath} (${buffer.length} bytes)`);

  if (dryRun) {
    return { legacyId: seed.legacyId, code: seed.code, cloudPath };
  }

  const fileId = await uploadBufferToCloudBase({
    envId,
    accessToken,
    cloudPath,
    buffer,
  });
  console.log(`   uploaded -> ${fileId}`);
  await updateActivityImageInDatabases(targets, seed.legacyId, cloudPath);
  return { legacyId: seed.legacyId, code: seed.code, cloudPath, fileId };
}

export async function uploadLocalActivityImages({
  assetsDir,
  rootDir,
  dryRun = false,
}) {
  const { byFilename } = buildSeedImageIndex();
  const files = (await readdir(assetsDir)).filter((name) => !name.startsWith('.'));
  const { envId, appId, appSecret } = getCloudBaseUploadConfig();

  if (!dryRun && (!envId || !appId || !appSecret)) {
    throw new Error(
      'Set CLOUDBASE_ENV_ID, WECHAT_MINI_APP_ID, WECHAT_MINI_APP_SECRET',
    );
  }

  const accessToken = dryRun
    ? ''
    : await getWeChatAccessToken(appId, appSecret);
  const targets = resolveMongoTargets(rootDir);
  const uploaded = [];

  for (const filename of files.sort()) {
    const seed = byFilename.get(filename);
    if (!seed) {
      console.warn(`⚠️  skip ${filename}: no matching activity in seed`);
      continue;
    }

    const buffer = await readFile(path.join(assetsDir, filename));
    uploaded.push(
      await uploadActivityImage({
        seed,
        buffer,
        envId,
        accessToken,
        targets,
        dryRun,
      }),
    );
  }

  return uploaded;
}

export function listMissingLocalActivityImages(assetsDir, existingFiles) {
  const { byCloudPath } = buildSeedImageIndex();
  const present = new Set(existingFiles);
  return ACTIVITY_SEED.filter((seed) => {
    const filename = path.basename(seed.image);
    return !present.has(filename);
  }).map((seed) => ({
    seed,
    filename: path.basename(seed.image),
    assetsPath: path.join(assetsDir, path.basename(seed.image)),
  }));
}
