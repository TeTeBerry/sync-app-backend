#!/usr/bin/env node
/**
 * Generate openapi/openapi.json from NestJS Swagger metadata.
 * Requires: npm run build (imports compiled dist).
 * Requires MongoDB at MONGODB_URI (CI provides mongo service).
 */
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

async function generate() {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }

  const { NestFactory } = require('@nestjs/core');
  const { ValidationPipe } = require('@nestjs/common');
  const { AppModule } = require('../dist/src/app.module');
  const {
    buildSwaggerDocument,
  } = require('../dist/src/common/swagger/swagger-document.util');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    bodyParser: false,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const document = buildSwaggerDocument(app);
  const outDir = join(process.cwd(), 'openapi');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'openapi.json');
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`[openapi:generate] wrote ${outPath}`);

  await app.close();
}

generate().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[openapi:generate] failed: ${message}`);
  process.exit(1);
});
