import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChromaModule } from '../../ai/rag/chroma.module';
import {
  UserBlock,
  UserBlockSchema,
} from '../../database/schemas/user-block.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { USER_REPOSITORY } from './interfaces/user.repository.interface';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

@Module({
  imports: [
    ChromaModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserBlock.name, schema: UserBlockSchema },
    ]),
  ],
  controllers: [UserController],
  providers: [
    UserRepository,
    { provide: USER_REPOSITORY, useExisting: UserRepository },
    UserService,
  ],
  exports: [UserService, USER_REPOSITORY],
})
export class UserModule {}
