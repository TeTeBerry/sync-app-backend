import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
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

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.postService.deleteOwnedPost(id, userId, authorName);
  }
}
