import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pindan, PindanSchema } from '../../database/schemas/pindan.schema';
import { ActivityModule } from '../activity/activity.module';
import { ProfileModule } from '../profile/profile.module';
import { PindanController } from './pindan.controller';
import { PindanService } from './pindan.service';

@Module({
  imports: [
    ActivityModule,
    forwardRef(() => ProfileModule),
    MongooseModule.forFeature([
      { name: Pindan.name, schema: PindanSchema },
    ]),
  ],
  controllers: [PindanController],
  providers: [PindanService],
  exports: [PindanService],
})
export class PindanModule {}
