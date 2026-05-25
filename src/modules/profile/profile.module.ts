import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PindanJoin,
  PindanJoinSchema,
} from '../../database/schemas/pindan-join.schema';
import { ActivityModule } from '../activity/activity.module';
import { PindanModule } from '../pindan/pindan.module';
import { TicketModule } from '../ticket/ticket.module';
import { NotificationModule } from '../notification/notification.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    ActivityModule,
    forwardRef(() => PindanModule),
    TicketModule,
    NotificationModule,
    MongooseModule.forFeature([
      { name: PindanJoin.name, schema: PindanJoinSchema },
    ]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
