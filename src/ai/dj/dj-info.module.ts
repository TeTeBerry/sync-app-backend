import { Module } from '@nestjs/common';
import { DjModule } from '../../modules/dj/dj.module';
import { ItineraryModule } from '../../modules/itinerary/itinerary.module';
import { ParserModule } from '../parser/parser.module';
import { DjInfoResolverService } from './dj-info-resolver.service';
import { DjInfoService } from './dj-info.service';

@Module({
  imports: [DjModule, ItineraryModule, ParserModule],
  providers: [DjInfoResolverService, DjInfoService],
  exports: [DjInfoResolverService, DjInfoService],
})
export class DjInfoModule {}
