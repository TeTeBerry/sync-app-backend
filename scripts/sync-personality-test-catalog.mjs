#!/usr/bin/env node
/**
 * Upsert personality test question catalog into MongoDB.
 *
 * Usage:
 *   npm run db:sync-personality-test
 *   MONGODB_URI=mongodb://127.0.0.1:27017/sync-ai node scripts/sync-personality-test-catalog.mjs
 */

import { execSync } from 'child_process';
import { createRequire } from 'node:module';
import {
  requireFromDist,
  resolveDistRoot,
} from './lib/resolve-dist-root.mjs';

const require = createRequire(import.meta.url);

if (!resolveDistRoot()) {
  console.log('dist missing — building…');
  execSync('nest build', { stdio: 'inherit' });
}

const { NestFactory } = require('@nestjs/core');
const { AppModule } = requireFromDist('app.module');
const { PersonalityTestCatalogService } = requireFromDist(
  'modules/personality-test/personality-test-catalog.service',
);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const catalogService = app.get(PersonalityTestCatalogService);
    await catalogService.seedCatalogData();
    console.log(
      '✅ Personality test catalog synced (personality_questions, personality_types, personality_dj_catalog)',
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(
    '❌ Personality test catalog sync failed:',
    error?.message ?? error,
  );
  process.exit(1);
});
