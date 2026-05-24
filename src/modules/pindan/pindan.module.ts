import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pindan, PindanSchema } from '../../database/schemas/pindan.schema';
import { ActivityModule } from '../activity/activity.module';
import { PindanController } from './pindan.controller';
import { PindanService } from './pindan.service';

@Module({
  imports: [
    ActivityModule,
    MongooseModule.forFeature([
      { name: Pindan.name, schema: PindanSchema },
    ]),
  ],
  controllers: [PindanController],
  providers: [PindanService],
  exports: [PindanService],
})
export class PindanModule {}
