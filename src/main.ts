import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filter/http-exception.filter';
import { TransformInterceptor } from './common/interceptor/transform.interceptor';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 跨域（支持流式、支持凭证、最稳定）
  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

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

  try {
    await app.listen(port);
    console.log(`🚀 API: http://localhost:${port}/api`);
    console.log(`✅ AI流式接口: POST http://localhost:${port}/api/ai/chat`);
    console.log(`📦 MongoDB: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
  } catch (error) {
    console.error('❌ 服务启动失败:', (error as Error).message);
    console.error('提示: 先运行 npm run infra:up 或 npm run dev:all 启动 MongoDB');
    process.exit(1);
  }
}
bootstrap();
