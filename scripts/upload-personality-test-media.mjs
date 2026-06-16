#!/usr/bin/env node
/**
 * Upload personality-test static media to CloudBase storage.
 *
 * Prerequisites:
 * - Source files under assets/personality-test/ (see README.md)
 * - CLOUDBASE_ENV_ID and WeChat credentials configured for tcb CLI
 *
 * Usage:
 *   node scripts/upload-personality-test-media.mjs
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets/personality-test');
const STATIC_PREFIX = 'static/personality-test';

async function collectFiles(dir, relative = '') {
  const entries = await readdir(path.join(dir, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.name === 'README.md') continue;
    const fullPath = path.join(dir, nextRelative);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(dir, nextRelative)));
      continue;
    }
    files.push({
      localPath: fullPath,
      cloudPath: `${STATIC_PREFIX}/${nextRelative.replace(/\\/g, '/')}`,
    });
  }
  return files;
}

async function main() {
  if (!existsSync(ASSETS_DIR)) {
    console.error(`Missing assets directory: ${ASSETS_DIR}`);
    process.exit(1);
  }

  const files = await collectFiles(ASSETS_DIR);
  if (!files.length) {
    console.error('No media files found. Add assets under assets/personality-test/ first.');
    process.exit(1);
  }

  const envId = process.env.CLOUDBASE_ENV_ID?.trim();
  if (!envId) {
    console.log('CLOUDBASE_ENV_ID not set. Files to upload:\n');
    for (const file of files) {
      console.log(`  ${file.localPath} -> ${file.cloudPath}`);
    }
    console.log('\nUpload via CloudBase console or configure CLOUDBASE_ENV_ID + tcb CLI.');
    process.exit(0);
  }

  let tcb;
  try {
    tcb = await import('@cloudbase/node-sdk');
  } catch {
    console.error('Install @cloudbase/node-sdk or upload files manually (see assets/personality-test/README.md).');
    process.exit(1);
  }

  const app = tcb.init({ env: envId });
  for (const file of files) {
    const buffer = await readFile(file.localPath);
    await app.uploadFile({
      cloudPath: file.cloudPath,
      fileContent: buffer,
    });
    console.log(`Uploaded ${file.cloudPath}`);
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
