#!/usr/bin/env node
/**
 * Upsert personality test question catalog into MongoDB.
 *
 * Usage:
 *   npm run db:sync-personality-test
 *   MONGODB_URI=mongodb://127.0.0.1:27017/sync-ai node scripts/sync-personality-test-catalog.mjs
 */

import { existsSync } from 'fs';
import { createRequire } from 'module';
import { execSync } from 'child_process';

const require = createRequire(import.meta.url);

if (!existsSync('dist/main.js')) {
  console.log('dist/main.js missing — building…');
  execSync('nest build', { stdio: 'inherit' });
}

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const {
  PersonalityTestCatalogService,
} = require('../dist/modules/personality-test/personality-test-catalog.service');

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
