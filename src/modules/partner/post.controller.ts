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
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { Public } from '../../common/auth/public.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdatePostRecruitDto } from './dto/update-post-recruit.dto';
import { AiSearchPostsDto } from './dto/ai-search-posts.dto';
import { CreatePostCommentDto } from './dto/create-post-comment.dto';
import { PostService } from './post.service';

const MAX_POPULAR_POSTS = 50;

@Controller('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Public()
  @Get('popular')
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
    );
  }

  @Post()
  create(@Body() body: CreatePostDto, @CurrentActor() actor: RequestActor) {
    return this.postService.createPost(body, actor);
  }

  @Patch(':id/recruit')
  updateRecruit(
    @Param('id') id: string,
    @Body() body: UpdatePostRecruitDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.postService.updatePostRecruit(id, body, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePostDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.postService.updatePost(id, body, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.postService.deleteOwnedPost(id, actor);
  }

  @Public()
  @Get(':id/comments')
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
  removeComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.postService.deleteOwnedComment(id, commentId, actor);
  }
}
