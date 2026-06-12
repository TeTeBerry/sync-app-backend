#!/usr/bin/env node
/**
 * Upsert festival sessions + artist performances (DJ lineup) into MongoDB.
 *
 * Usage:
 *   npm run db:seed-itinerary
 *   MONGODB_URI=mongodb://127.0.0.1:27017/sync-ai node scripts/seed-itinerary-catalog.mjs
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
const { ItineraryScheduleService } = require('../dist/modules/itinerary/itinerary-schedule.service');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const scheduleService = app.get(ItineraryScheduleService);
    await scheduleService.seedItineraryCatalogData();
    console.log('✅ Itinerary catalog seeded (festival_sessions + artist_performances)');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('❌ Itinerary catalog seed failed:', error?.message ?? error);
  process.exit(1);
});
