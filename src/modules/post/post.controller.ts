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
import { CreatePostCommentDto } from './dto/create-post-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostService } from './post.service';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get('popular')
  listPopular(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 20;
    return this.postService.listPopular(Number.isNaN(parsed) ? 20 : parsed);
  }

  @Get()
  list(
    @Query('activityLegacyId') activityLegacyId?: string,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    if (activityLegacyId) {
      const id = Number(activityLegacyId);
      if (!Number.isNaN(id)) {
        return this.postService.listByActivity(id);
      }
    }
    return this.postService.listByOwner(userId, authorName);
  }

  @Post()
  create(
    @Body() body: CreatePostDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.postService.createPost(body, userId, authorName);
  }

  @Post(':id/like')
  like(
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.postService.likePost(id, userId, authorName);
  }

  @Post(':id/applications')
  apply(
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.postService.applyToPost(id, userId, authorName);
  }

  @Post(':id/comments')
  comment(
    @Param('id') id: string,
    @Body() body: CreatePostCommentDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.postService.addComment(id, body.body, userId, authorName, body.parentCommentId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePostDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.postService.updateOwnedPost(id, body, userId, authorName);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.postService.deleteOwnedPost(id, userId, authorName);
  }
}
