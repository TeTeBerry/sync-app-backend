import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { UpdateUserMeDto } from './dto/update-user-me.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @Get('health')
  health() {
    return this.userService.ping();
  }

  @Get('me')
  me(@CurrentActor() actor: RequestActor) {
    return this.userService.getMe(actor);
  }

  @Patch('me')
  updateMe(@Body() body: UpdateUserMeDto, @CurrentActor() actor: RequestActor) {
    return this.userService.patchMe(body, actor);
  }
}
