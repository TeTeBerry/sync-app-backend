import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { CreatePostDto } from './dto/create-post.dto';
import { AiSearchPostsDto } from './dto/ai-search-posts.dto';
import { CreatePostCommentDto } from './dto/create-post-comment.dto';
import { PostService } from './post.service';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Public()
  @Get('popular')
  listPopular(
    @CurrentActor() actor: RequestActor,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 20;
    return this.postService.listPopular(
      Number.isNaN(parsed) ? 20 : parsed,
      actor,
    );
  }

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
    return this.postService.listByOwner(actor);
  }

  @Public()
  @Post('ai-search')
  aiSearch(
    @Body() body: AiSearchPostsDto,
    @CurrentActor() actor: RequestActor,
  ) {
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

  @Get(':id/navigation-target')
  getNavigationTarget(@Param('id') id: string) {
    return this.postService.getPostNavigationTarget(id);
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
}
