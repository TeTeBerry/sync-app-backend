import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../../ai/agents/agents.module';
import { SceneRunModule } from '../../ai/scene/scene-run.module';
import { ActivityModule } from '../activity/activity.module';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { UserGoalSchema } from './goal.model';
import { UserGoalService } from './goal.service';
import { UserGoalController } from './goal.controller';
import { GoalOrchestrator } from './goal-orchestrator.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'UserGoal', schema: UserGoalSchema }]),
    forwardRef(() => ActivityModule),
    forwardRef(() => SceneRunModule),
    AgentsModule,
    ActivityLookupModule,
  ],
  providers: [UserGoalService, GoalOrchestrator],
  controllers: [UserGoalController],
  exports: [UserGoalService, GoalOrchestrator],
})
export class UserGoalModule {}
