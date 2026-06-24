import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { buildStaticKnowledgeDocuments } from './build-static-knowledge-documents.util';
import { ChromaService } from './chroma.service';
import { buildActivityKnowledgeDocument } from './chroma-activity-document.util';
import { ActivityLookupService } from '../../modules/activity/activity-lookup.service';

@Injectable()
export class ChromaCatalogSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChromaCatalogSyncService.name);

  constructor(
    private readonly chromaService: ChromaService,
    private readonly activityLookup: ActivityLookupService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.chromaService.isEnabled()) return;

    try {
      const activities = await this.activityLookup.findAllBasics();
      const staticDocs = buildStaticKnowledgeDocuments();
      const catalogDocs = activities.map((activity) =>
        buildActivityKnowledgeDocument({
          code: activity.code,
          name: activity.name,
          alias: activity.alias,
          date: activity.date,
          location: activity.location,
          area: activity.area,
          region: activity.region,
          activityType: activity.activityType,
        }),
      );

      await this.chromaService.upsertDocuments([...staticDocs, ...catalogDocs]);

      this.logger.log(
        `Chroma catalog sync: ${catalogDocs.length} activities + ${staticDocs.length} static docs`,
      );
    } catch (error) {
      this.logger.warn(
        `Chroma catalog sync skipped: ${(error as Error).message}`,
      );
    }
  }
}
