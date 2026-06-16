import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from '../../database/schemas/post.schema';
import { POST_REPOSITORY } from './interfaces/post.repository.interface';
import { PostRepository } from './post.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
  ],
  providers: [
    PostRepository,
    { provide: POST_REPOSITORY, useExisting: PostRepository },
  ],
  exports: [POST_REPOSITORY],
})
export class PartnerRepositoryModule {}
