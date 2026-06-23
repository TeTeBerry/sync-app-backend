import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnvValue } from './parse-env-file.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

export function maskMongoUri(uri) {
  return uri.replace(/:[^:@/]+@/, ':***@');
}

export function resolveSourceMongoUri() {
  return (
    process.env.SOURCE_MONGODB_URI ??
    process.env.LOCAL_MONGODB_URI ??
    process.env.MONGODB_URI ??
    process.env.MONGO_URI ??
    'mongodb://127.0.0.1:27017/sync-ai'
  );
}

/** Default: local + cloud (deduped by URI). */
export function resolveLocalAndCloudTargets(argv = process.argv) {
  const localOnly = argv.includes('--local-only');
  const cloudOnly = argv.includes('--cloud-only');

  const localUri =
    process.env.LOCAL_MONGODB_URI ??
    process.env.MONGODB_URI ??
    process.env.MONGO_URI ??
    'mongodb://127.0.0.1:27017/sync-ai';

  const cloudUri =
    process.env.CLOUD_MONGODB_URI ??
    readEnvValue(path.join(ROOT, '.env.production'), 'MONGODB_URI');

  const targets = [];

  if (!cloudOnly) {
    targets.push({ label: 'local', uri: localUri });
  }

  if (!localOnly && cloudUri) {
    if (!targets.some((target) => target.uri === cloudUri)) {
      targets.push({ label: 'cloud', uri: cloudUri });
    }
  }

  if (targets.length === 0) {
    throw new Error(
      'No MongoDB targets. Set CLOUD_MONGODB_URI or add MONGODB_URI to .env.production',
    );
  }

  return targets;
}
