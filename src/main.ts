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

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Headers the H5 client may send (REST + WebSocket preflight). */
const PROD_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'X-Activity-Id',
  'X-Request-Id',
];

function resolveCorsOrigin():
  | boolean
  | string[]
  | ((
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => void) {
  const configured = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured?.length) {
    if (configured.length === 1 && configured[0] === '*') {
      return true;
    }
    return configured;
  }

  if (IS_PRODUCTION) {
    return false;
  }

  // Dev: reflect any Origin (localhost any port, 127.0.0.1, LAN IP for phone testing)
  return true;
}

function resolveCorsOptions(): {
  origin: ReturnType<typeof resolveCorsOrigin>;
  credentials: boolean;
  methods: string[];
  allowedHeaders?: string[];
} {
  const options = {
    origin: resolveCorsOrigin(),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  };

  // Dev: omit allowedHeaders so cors echoes Access-Control-Request-Headers
  if (!IS_PRODUCTION) {
    return options;
  }

  return {
    ...options,
    allowedHeaders: PROD_ALLOWED_HEADERS,
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // AI 聊天上传门票截图（Base64）需放宽 JSON 体积限制
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));

  const uploadDir = process.env.UPLOAD_DIR?.trim() || './uploads';
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  app.use('/uploads', expressStatic(join(process.cwd(), uploadDir)));

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
    }),
  );

  // 全局过滤器 & 拦截器（你原有的，保留！更规范）
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT || 3000;
  const mongoUri = process.env.MONGODB_URI ?? process.env.MONGO_URI ?? '(default)';
  const logger = new Logger('Bootstrap');

  try {
    await app.listen(port);
    const httpServer = app.getHttpServer();
    app.get(AiChatWsServer).attach(httpServer);
    logger.log(`🚀 API: http://localhost:${port}/api`);
    logger.log(`✅ AI WebSocket: ws://localhost:${port}${AI_CHAT_WS_PATH}`);
    logger.log(`📦 MongoDB: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    if (IS_PRODUCTION && !process.env.CORS_ORIGINS) {
      logger.warn('⚠️  CORS disabled: set CORS_ORIGINS in production');
    } else if (!IS_PRODUCTION) {
      logger.log('🌐 CORS: dev mode (reflect origin, echo preflight headers)');
    }
  } catch (error) {
    const message = (error as Error).message ?? String(error);
    if (message.includes('EADDRINUSE')) {
      logger.error(`❌ 端口 ${port} 已被占用（可能有多个 start:dev 在跑）`);
      logger.error('请先执行: npm run stop:dev');
      logger.error('并确保只保留一个后端终端窗口');
    } else {
      logger.error('❌ 服务启动失败:', message);
      logger.error('提示: 先运行 npm run infra:up 或 npm run dev:all 启动 MongoDB');
    }
    process.exit(1);
  }
}
bootstrap();
