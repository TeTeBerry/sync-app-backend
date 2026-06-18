import { NestFactory } from '@nestjs/core';
import { json, urlencoded, static as expressStatic } from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { AiChatWsServer } from './ai/ws/ai-chat-ws.server';
import { AI_CHAT_WS_PATH } from './ai/ws/ai-chat-ws.protocol';
import { HttpExceptionFilter } from './common/filter/http-exception.filter';
import { TransformInterceptor } from './common/interceptor/transform.interceptor';
import { Logger, ValidationPipe } from '@nestjs/common';
import {
  describeCorsPolicy,
  parseCorsOrigins,
  resolveCorsOptions,
} from './common/cors/cors-config.util';
import { isLegacyLocalUploadEnabled } from './common/media/local-upload.util';
import { validateProductionConfig } from './config/validate-production-config';
import { ConfigService } from '@nestjs/config';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // AI 聊天上传门票截图（Base64）需放宽 JSON 体积限制
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));

  if (isLegacyLocalUploadEnabled()) {
    const uploadDir = process.env.UPLOAD_DIR?.trim() || './uploads';
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }
    app.use('/uploads', expressStatic(join(process.cwd(), uploadDir)));
    logger.log(`📁 Local uploads: /uploads → ${uploadDir}`);
  }

  app.enableShutdownHooks();

  const corsOptions = resolveCorsOptions();
  app.enableCors(corsOptions);

  // 全局路由前缀
  app.setGlobalPrefix('api');

  // 全局参数校验（必须加，否则 dto 不生效）
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  validateProductionConfig(app.get(ConfigService));

  // 全局过滤器 & 拦截器（你原有的，保留！更规范）
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT || 3000;
  const mongoUri =
    process.env.MONGODB_URI ?? process.env.MONGO_URI ?? '(default)';

  try {
    await app.listen(port);
    const httpServer = app.getHttpServer();
    app.get(AiChatWsServer).attach(httpServer);
    logger.log(`🚀 API: http://localhost:${port}/api`);
    logger.log(`✅ AI WebSocket: ws://localhost:${port}${AI_CHAT_WS_PATH}`);
    logger.log(`📦 MongoDB: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    const corsOrigins = parseCorsOrigins();
    const corsMessage = describeCorsPolicy(process.env.NODE_ENV, corsOrigins);
    if (IS_PRODUCTION && !corsOrigins) {
      logger.warn(`⚠️  ${corsMessage}`);
    } else {
      logger.log(`🌐 ${corsMessage}`);
    }
  } catch (error) {
    const message = (error as Error).message ?? String(error);
    if (message.includes('EADDRINUSE')) {
      logger.error(`❌ 端口 ${port} 已被占用（可能有多个 start:dev 在跑）`);
      logger.error('请先执行: npm run stop:dev');
      logger.error('并确保只保留一个后端终端窗口');
    } else {
      logger.error('❌ 服务启动失败:', message);
      logger.error(
        '提示: 先运行 npm run infra:up 或 npm run dev:all 启动 MongoDB',
      );
    }
    process.exit(1);
  }
}
bootstrap();
