import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { Dj, DjSchema } from '../../database/schemas/dj.schema';
import {
  DjDiscogsMap,
  DjDiscogsMapSchema,
} from '../../database/schemas/dj-discogs-map.schema';
import { DjLocaleService } from './dj-locale.service';
import { DjService } from './dj.service';

@Module({
  imports: [
    InfraLlmModule,
    MongooseModule.forFeature([
      { name: Dj.name, schema: DjSchema },
      { name: DjDiscogsMap.name, schema: DjDiscogsMapSchema },
    ]),
  ],
  providers: [DjService, DjLocaleService],
  exports: [DjService, DjLocaleService],
})
export class DjModule {}
