import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParserModule } from '../../ai/parser/parser.module';
import { Dj, DjSchema } from '../../database/schemas/dj.schema';
import { DjLocaleService } from './dj-locale.service';
import { DjService } from './dj.service';

@Module({
  imports: [
    ParserModule,
    MongooseModule.forFeature([{ name: Dj.name, schema: DjSchema }]),
  ],
  providers: [DjService, DjLocaleService],
  exports: [DjService, DjLocaleService],
})
export class DjModule {}
