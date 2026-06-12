import { Controller, Get } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { HomeService } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  /** Catalog feed — guests may browse; `going` uses JWT actor when present. */
  @Public()
  @Get()
  summary(@CurrentActor() actor: RequestActor) {
    return this.homeService.getSummary(actor);
  }
}
