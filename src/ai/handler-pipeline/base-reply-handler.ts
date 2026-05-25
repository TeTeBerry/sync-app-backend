import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyMatcher,
  ReplyPlanner,
  ReplyExecutor,
  ReplyComposer,
  ReplyHandler,
  AgentToolCall,
  AgentStateProgression,
} from './handler-pipeline.types';

/**
 * Abstract base class implementing the Handler Pipeline pattern.
 * Subclasses supply their Matcher, Planner, Executor, and Composer via constructor.
 * Eliminates duplicated boilerplate across all concrete handlers.
 *
 * Usage:
 *   class MyHandler extends BaseReplyHandler<ExecutorResult> {
 *     readonly id = 'my-handler';
 *     constructor(
 *       matcher: MyMatcher, planner: MyPlanner, executor: MyExecutor, composer: MyComposer,
 *     ) { super(matcher, planner, executor, composer); }
 *   }
 */
export abstract class BaseReplyHandler<TExecuteResult = unknown>
  implements ReplyHandler
{
  abstract readonly id: string;

  constructor(
    private readonly matcher: ReplyMatcher,
    private readonly planner: ReplyPlanner,
    private readonly executor: ReplyExecutor<TExecuteResult>,
    private readonly composer: ReplyComposer<TExecuteResult>,
  ) {}

  canHandle(ctx: ReplyContext): boolean | Promise<boolean> {
    return this.matcher.matches(ctx);
  }

  getPlannedToolCalls(ctx: ReplyContext): AgentToolCall[] {
    return this.planner.plan(ctx);
  }

  getStateProgression?(ctx: ReplyContext): AgentStateProgression | null;

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
    const result = await this.executor.execute(ctx);
    if (!result) return null;
    return this.composer.compose(ctx, result);
  }
}
