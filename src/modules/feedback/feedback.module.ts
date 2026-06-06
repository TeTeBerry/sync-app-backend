import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  UserFeedback,
  UserFeedbackSchema,
} from '../../database/schemas/user-feedback.schema';
import { AuthModule } from '../auth/auth.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: UserFeedback.name, schema: UserFeedbackSchema },
    ]),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
