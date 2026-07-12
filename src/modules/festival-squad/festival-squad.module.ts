import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConnectionRequest,
  ConnectionRequestSchema,
} from '../../database/schemas/connection-request.schema';
import {
  FestivalSquadProfile,
  FestivalSquadProfileSchema,
} from '../../database/schemas/festival-squad-profile.schema';
import { FestivalSquadController } from './festival-squad.controller';
import { FestivalSquadMatcher } from './festival-squad.matcher';
import { FestivalSquadRepository } from './festival-squad.repository';
import { FestivalSquadService } from './festival-squad.service';
import { LineupCatalogModule } from '../itinerary/lineup-catalog.module';
@Module({
  imports: [
    LineupCatalogModule,
    MongooseModule.forFeature([
      { name: FestivalSquadProfile.name, schema: FestivalSquadProfileSchema },
      { name: ConnectionRequest.name, schema: ConnectionRequestSchema },
    ]),
  ],
  controllers: [FestivalSquadController],
  providers: [
    FestivalSquadService,
    FestivalSquadRepository,
    FestivalSquadMatcher,
  ],
})
export class FestivalSquadModule {}
