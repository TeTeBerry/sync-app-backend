import { Module } from '@nestjs/common';
import { ITINERARY_PORT } from './ports/itinerary-agent.port';
import { ItineraryAgentAdapter } from './itinerary-agent.adapter';
import { ItineraryModule } from './itinerary.module';

/** AI agent surface — ChatAgent / handlers import this instead of full ItineraryModule. */
@Module({
  imports: [ItineraryModule],
  providers: [
    ItineraryAgentAdapter,
    { provide: ITINERARY_PORT, useExisting: ItineraryAgentAdapter },
  ],
  exports: [ITINERARY_PORT],
})
export class ItineraryAgentPortsModule {}
