import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PindanJoin,
  PindanJoinSchema,
} from '../../database/schemas/pindan-join.schema';
import { PindanModule } from '../pindan/pindan.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    forwardRef(() => PindanModule),
    MongooseModule.forFeature([
      { name: PindanJoin.name, schema: PindanJoinSchema },
    ]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
