import { IsIn, IsString } from 'class-validator';
import type { ActorSource, RequestActor } from './request-actor.types';

/** Validated `RequestActor` for nested DTOs (set server-side, not from untrusted client JSON). */
export class RequestActorDto implements RequestActor {
  @IsIn(['jwt', 'demo'])
  source!: ActorSource;

  @IsString()
  clientUserId!: string;

  @IsString()
  displayName!: string;

  @IsString()
  resolvedUserId!: string;
}
