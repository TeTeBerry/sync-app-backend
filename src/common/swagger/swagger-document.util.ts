import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiEnvelopeDto } from './api-envelope.dto';
import {
  ActivityHealthDto,
  ActivityRegistrationResultDto,
  ActivityResolveResultDto,
  ActivityUnregisterResultDto,
  ActivityWechatUpdateOptInResultDto,
  BackendActivityDto,
  CatalogLineupArtistDto,
} from './dto/activity.swagger.dto';
import {
  AuthLoginResultDto,
  AuthLogoutResultDto,
} from './dto/auth.swagger.dto';
import {
  BuddyPostAiSearchResultDto,
  EventDetailPostDto,
  EventPostsPageDto,
  PostCommentItemDto,
  PostCommentsPageDto,
  PostMutationResultDto,
} from './dto/post.swagger.dto';
import {
  GenerateTravelGuideResultDto,
  PlaceSuggestionsResultDto,
  ReverseGeocodeResultDto,
  TravelGuideBudgetTierResultDto,
  TravelGuideGenerationJobResultDto,
  TravelGuidePlanReadResultDto,
} from './dto/travel-guide.swagger.dto';

export function buildSwaggerDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Sync API')
    .setDescription(
      'Sync App REST API. Responses are wrapped by TransformInterceptor as { code, message, data }.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();

  return SwaggerModule.createDocument(app, config, {
    extraModels: [
      ApiEnvelopeDto,
      AuthLoginResultDto,
      AuthLogoutResultDto,
      BackendActivityDto,
      ActivityHealthDto,
      ActivityRegistrationResultDto,
      ActivityUnregisterResultDto,
      ActivityWechatUpdateOptInResultDto,
      ActivityResolveResultDto,
      CatalogLineupArtistDto,
      EventDetailPostDto,
      EventPostsPageDto,
      PostCommentItemDto,
      PostCommentsPageDto,
      BuddyPostAiSearchResultDto,
      PostMutationResultDto,
      GenerateTravelGuideResultDto,
      TravelGuideGenerationJobResultDto,
      TravelGuidePlanReadResultDto,
      TravelGuideBudgetTierResultDto,
      PlaceSuggestionsResultDto,
      ReverseGeocodeResultDto,
    ],
  });
}

export function setupSwaggerUi(app: INestApplication, path = 'api/docs') {
  const document = buildSwaggerDocument(app);
  SwaggerModule.setup(path, app, document);
  return document;
}
