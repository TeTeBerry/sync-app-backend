import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { USER_REPOSITORY } from './interfaces/user.repository.interface';
import { UserRepository } from './user.repository';

/** User persistence only — breaks UserModule ↔ MediaSecurityModule cycles. */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [
    UserRepository,
    { provide: USER_REPOSITORY, useExisting: UserRepository },
  ],
  exports: [USER_REPOSITORY, UserRepository],
})
export class UserRepositoryModule {}
