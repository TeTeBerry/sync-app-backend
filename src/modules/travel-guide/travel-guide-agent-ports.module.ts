import { Module } from '@nestjs/common';
import { TRAVEL_GUIDE_PORT } from './ports/travel-guide-agent.port';
import { TravelGuideAgentAdapter } from './travel-guide-agent.adapter';
import { TravelGuideModule } from './travel-guide.module';

/** AI agent surface — ChatAgent imports this instead of full TravelGuideModule. */
@Module({
  imports: [TravelGuideModule],
  providers: [
    TravelGuideAgentAdapter,
    { provide: TRAVEL_GUIDE_PORT, useExisting: TravelGuideAgentAdapter },
  ],
  exports: [TRAVEL_GUIDE_PORT],
})
export class TravelGuideAgentPortsModule {}
