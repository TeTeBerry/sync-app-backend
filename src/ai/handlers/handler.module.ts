import { Module } from '@nestjs/common';
import {
  HandlerRegistryService,
  HANDLER_REGISTRY_TOKEN,
} from '../handler-pipeline';
import { ActivityModule } from '../../modules/activity/activity.module';
import { PindanModule } from '../../modules/pindan/pindan.module';
import { ProfileModule } from '../../modules/profile/profile.module';
import { TicketModule } from '../../modules/ticket/ticket.module';
import { TicketListingService } from '../ticket/ticket-listing.service';
import { FindBuddyPindanCreateService } from '../pindan/find-buddy-pindan-create.service';
import {
  QuickReplyHandler,
  QuickReplyMatcher,
  QuickReplyPlanner,
  QuickReplyExecutor,
  QuickReplyComposer,
} from './quick-reply';
import {
  PindanJoinHandler,
  PindanJoinMatcher,
  PindanJoinPlanner,
  PindanJoinExecutor,
  PindanJoinComposer,
} from './pindan-join';
import {
  FindBuddyCollectHandler,
  FindBuddyCollectMatcher,
  FindBuddyCollectPlanner,
  FindBuddyCollectExecutor,
  FindBuddyCollectComposer,
} from './find-buddy-collect';
import {
  PackagePickHandler,
  PackagePickMatcher,
  PackagePickPlanner,
  PackagePickExecutor,
  PackagePickComposer,
} from './package-pick';
import {
  PindanCreateHandler,
  PindanCreateMatcher,
  PindanCreatePlanner,
  PindanCreateExecutor,
  PindanCreateComposer,
} from './pindan-create';
import { TicketListingHandler } from './ticket-listing';
import {
  StructuredReplyHandler,
  StructuredReplyMatcher,
  StructuredReplyPlanner,
  StructuredReplyExecutor,
  StructuredReplyComposer,
} from './structured-reply';
import {
  TicketSearchHandler,
  TicketSearchMatcher,
  TicketSearchPlanner,
  TicketSearchExecutor,
  TicketSearchComposer,
} from './ticket-search';
import {
  TicketSelectHandler,
  TicketSelectMatcher,
  TicketSelectPlanner,
  TicketSelectExecutor,
  TicketSelectComposer,
} from './ticket-select';

@Module({
  imports: [ActivityModule, PindanModule, ProfileModule, TicketModule],
  providers: [
    QuickReplyMatcher,
    QuickReplyPlanner,
    QuickReplyExecutor,
    QuickReplyComposer,
    StructuredReplyMatcher,
    StructuredReplyPlanner,
    StructuredReplyExecutor,
    StructuredReplyComposer,
    TicketSearchMatcher,
    TicketSearchPlanner,
    TicketSearchExecutor,
    TicketSearchComposer,
    TicketSelectMatcher,
    TicketSelectPlanner,
    TicketSelectExecutor,
    TicketSelectComposer,
    PindanJoinMatcher,
    PindanJoinPlanner,
    PindanJoinExecutor,
    PindanJoinComposer,
    PindanCreateMatcher,
    PindanCreatePlanner,
    PindanCreateExecutor,
    PindanCreateComposer,
    FindBuddyCollectMatcher,
    FindBuddyCollectPlanner,
    FindBuddyCollectExecutor,
    FindBuddyCollectComposer,
    PackagePickMatcher,
    PackagePickPlanner,
    PackagePickExecutor,
    PackagePickComposer,
    QuickReplyHandler,
    PindanJoinHandler,
    FindBuddyCollectHandler,
    PackagePickHandler,
    PindanCreateHandler,
    TicketListingHandler,
    StructuredReplyHandler,
    TicketSearchHandler,
    TicketSelectHandler,
    {
      provide: HANDLER_REGISTRY_TOKEN,
      useFactory: (
        quickReply: QuickReplyHandler,
        pindanJoin: PindanJoinHandler,
        findBuddyCollect: FindBuddyCollectHandler,
        packagePick: PackagePickHandler,
        pindanCreate: PindanCreateHandler,
        ticketListing: TicketListingHandler,
        structuredReply: StructuredReplyHandler,
        ticketSearch: TicketSearchHandler,
        ticketSelect: TicketSelectHandler,
      ) => [
        quickReply,
        pindanJoin,
        findBuddyCollect,
        packagePick,
        pindanCreate,
        ticketListing,
        structuredReply,
        ticketSearch,
        ticketSelect,
      ],
      inject: [
        QuickReplyHandler,
        PindanJoinHandler,
        FindBuddyCollectHandler,
        PackagePickHandler,
        PindanCreateHandler,
        TicketListingHandler,
        StructuredReplyHandler,
        TicketSearchHandler,
        TicketSelectHandler,
      ],
    },
    HandlerRegistryService,
    TicketListingService,
    FindBuddyPindanCreateService,
  ],
  exports: [
    HandlerRegistryService,
    TicketListingService,
    FindBuddyPindanCreateService,
  ],
})
export class HandlerModule {}
