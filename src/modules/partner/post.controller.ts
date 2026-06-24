import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { Public } from '../../common/auth/public.decorator';
import {
  ApiOkEnvelopeArrayResponse,
  ApiOkEnvelopeResponse,
} from '../../common/swagger/api-response.decorator';
import {
  BuddyPostAiComposeResultDto,
  BuddyPostAiSearchResultDto,
  EventDetailPostDto,
  EventPostsPageDto,
  PostCommentsPageDto,
  PostMutationResultDto,
} from '../../common/swagger/dto/post.swagger.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdatePostRecruitDto } from './dto/update-post-recruit.dto';
import { AiSearchPostsDto } from './dto/ai-search-posts.dto';
import { AiComposePostsDto } from './dto/ai-compose-posts.dto';
import { CreatePostCommentDto } from './dto/create-post-comment.dto';
import { PostService } from './post.service';

const MAX_POPULAR_POSTS = 50;

@ApiTags('posts')
@Controller('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Public()
  @Get('popular')
  @ApiOperation({ summary: 'List popular buddy posts' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkEnvelopeArrayResponse(EventDetailPostDto)
  listPopular(
    @CurrentActor() actor: RequestActor,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 20;
    const safeLimit = Number.isNaN(parsed)
      ? 20
      : Math.min(Math.max(parsed, 1), MAX_POPULAR_POSTS);
    return this.postService.listPopular(safeLimit, actor);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List posts by activity or current user' })
  @ApiQuery({ name: 'activityLegacyId', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'anchorPostId', required: false, type: String })
  @ApiOkEnvelopeResponse(EventPostsPageDto, {
    description: 'Paginated posts for an activity',
  })
  list(
    @CurrentActor() actor: RequestActor,
    @Query('activityLegacyId') activityLegacyId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('anchorPostId') anchorPostId?: string,
  ) {
    if (activityLegacyId) {
      const id = Number(activityLegacyId);
      if (!Number.isNaN(id)) {
        const parsedLimit = limit ? Number(limit) : undefined;
        return this.postService.listByActivityPage(
          id,
          {
            limit:
              parsedLimit != null && !Number.isNaN(parsedLimit)
                ? parsedLimit
                : undefined,
            cursor,
            anchorPostId,
          },
          actor,
        );
      }
    }
    if (!actor.resolvedUserId?.trim()) {
      throw new UnauthorizedException('请先登录');
    }
    return this.postService.listByOwner(actor);
  }

  @Post('ai-search')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Natural language buddy post search' })
  @ApiOkEnvelopeResponse(BuddyPostAiSearchResultDto)
  async aiSearch(
    @Body() body: AiSearchPostsDto,
    @CurrentActor() actor: RequestActor,
    @Req() req: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'post_ai_search',
      req,
      actor.resolvedUserId,
    );
    return this.postService.searchPostsByNaturalLanguage(
      body.query,
      body.activityLegacyId,
      actor,
      { applyPreferenceRank: body.applyPreferenceRank },
    );
  }

  @Post('ai-compose')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Generate AI buddy post note candidates' })
  @ApiOkEnvelopeResponse(BuddyPostAiComposeResultDto)
  async aiCompose(
    @Body() body: AiComposePostsDto,
    @CurrentActor() actor: RequestActor,
    @Req() req: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'post_ai_compose',
      req,
      actor.resolvedUserId,
    );
    return this.postService.composeBuddyPostCandidates(body, actor);
  }

  @Post()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a buddy post' })
  @ApiOkEnvelopeResponse(PostMutationResultDto)
  create(@Body() body: CreatePostDto, @CurrentActor() actor: RequestActor) {
    return this.postService.createPost(body, actor);
  }

  @Patch(':id/recruit')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update post recruit status' })
  @ApiOkEnvelopeResponse(PostMutationResultDto)
  updateRecruit(
    @Param('id') id: string,
    @Body() body: UpdatePostRecruitDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.postService.updatePostRecruit(id, body, actor);
  }

  @Patch(':id')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update post content' })
  @ApiOkEnvelopeResponse(PostMutationResultDto)
  update(
    @Param('id') id: string,
    @Body() body: UpdatePostDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.postService.updatePost(id, body, actor);
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete owned post' })
  @ApiOkEnvelopeResponse(PostMutationResultDto)
  remove(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.postService.deleteOwnedPost(id, actor);
  }

  @Public()
  @Get(':id/comments')
  @ApiOperation({ summary: 'List comments for a post' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiOkEnvelopeResponse(PostCommentsPageDto)
  listComments(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = limit ? Number(limit) : undefined;
    return this.postService.listComments(id, {
      limit: parsed != null && !Number.isNaN(parsed) ? parsed : undefined,
      cursor,
    });
  }

  @Post(':id/comments')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Add comment to post' })
  @ApiOkEnvelopeResponse(PostMutationResultDto)
  addComment(
    @Param('id') id: string,
    @Body() body: CreatePostCommentDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.postService.addComment(
      id,
      body.body,
      actor,
      body.parentCommentId,
    );
  }

  @Delete(':id/comments/:commentId')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete owned comment' })
  @ApiOkEnvelopeResponse(PostMutationResultDto)
  removeComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.postService.deleteOwnedComment(id, commentId, actor);
  }
}
