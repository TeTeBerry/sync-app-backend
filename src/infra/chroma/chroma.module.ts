import { Module } from '@nestjs/common';
import { ActivityLookupModule } from '../../modules/activity/activity-lookup.module';
import { ChromaCatalogSyncService } from './chroma-catalog-sync.service';
import { ChromaService } from './chroma.service';

@Module({
  imports: [ActivityLookupModule],
  providers: [ChromaService, ChromaCatalogSyncService],
  exports: [ChromaService],
})
export class InfraChromaModule {}
