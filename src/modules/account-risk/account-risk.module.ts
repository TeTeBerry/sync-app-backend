import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AccountRiskEvent,
  AccountRiskEventSchema,
} from '../../database/schemas/account-risk-event.schema';
import {
  ContentReport,
  ContentReportSchema,
} from '../../database/schemas/content-report.schema';
import { Post, PostSchema } from '../../database/schemas/post.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { AccountRiskService } from './account-risk.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccountRiskEvent.name, schema: AccountRiskEventSchema },
      { name: User.name, schema: UserSchema },
      { name: ContentReport.name, schema: ContentReportSchema },
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  providers: [AccountRiskService],
  exports: [AccountRiskService],
})
export class AccountRiskModule {}
