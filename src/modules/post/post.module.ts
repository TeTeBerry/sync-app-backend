import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from '../../database/schemas/post.schema';
import { POST_REPOSITORY } from './interfaces/post.repository.interface';
import { PostController } from './post.controller';
import { PostRepository } from './post.repository';
import { PostService } from './post.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
  ],
  controllers: [PostController],
  providers: [
    PostRepository,
    { provide: POST_REPOSITORY, useExisting: PostRepository },
    PostService,
  ],
  exports: [PostService, POST_REPOSITORY],
})
export class PostModule {}
