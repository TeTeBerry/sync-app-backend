import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { CreatePostCommentDto } from './dto/create-post-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostService } from './post.service';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

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

  @Get('all')
  listAll(@CurrentActor() actor: RequestActor) {
    return this.postService.listAll(actor);
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

  @Post()
  create(@Body() body: CreatePostDto, @CurrentActor() actor: RequestActor) {
    return this.postService.createPost(body, actor);
  }

  @Post(':id/like')
  like(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.postService.likePost(id, actor);
  }

  @Post(':id/applications')
  apply(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.postService.applyToPost(id, actor);
  }

  @Get(':id/comments')
  listComments(@Param('id') id: string) {
    return this.postService.listComments(id);
  }

  @Post(':id/comments')
  comment(
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

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePostDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.postService.updateOwnedPost(id, body, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentActor() actor: RequestActor) {
    return this.postService.deleteOwnedPost(id, actor);
  }
}
