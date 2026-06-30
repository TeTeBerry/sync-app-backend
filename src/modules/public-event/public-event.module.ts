import { Module } from '@nestjs/common';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { LineupCatalogModule } from '../itinerary/lineup-catalog.module';
import { PublicEventController } from './public-event.controller';

@Module({
  imports: [ActivityLookupModule, LineupCatalogModule],
  controllers: [PublicEventController],
})
export class PublicEventModule {}
