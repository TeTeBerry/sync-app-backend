import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from '../src/common/filter/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptor/transform.interceptor';

describe('AppModule (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/home (GET)', () => {
    return request(app.getHttpServer()).get('/api/home').expect(200);
  });

  it('/api/activities/:legacyId/travel-plan/saved (GET) demo query', () => {
    return request(app.getHttpServer())
      .get('/api/activities/4/travel-plan/saved')
      .query({ userId: 'e2e-travel-plan-user' })
      .expect(200)
      .expect((res) => {
        expect(res.body.code).toBe(200);
        expect(Array.isArray(res.body.data?.nodes)).toBe(true);
      });
  });
});
