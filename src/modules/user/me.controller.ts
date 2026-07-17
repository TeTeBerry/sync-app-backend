import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateRavenProfileDto } from './dto/update-raven-profile.dto';
import { UserService } from './user.service';

@Controller('me')
export class MeController {
  constructor(private readonly users: UserService) {}

  @Get('profile') profile(@CurrentActor() actor: RequestActor) {
    return this.users.getRavenProfile(actor);
  }
  @Patch('profile') patchProfile(
    @Body() body: UpdateRavenProfileDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.users.patchRavenProfile(body, actor);
  }
  @Delete('account')
  async deleteAccount(
    @Body() body: DeleteAccountDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.users.deleteAccount(actor);
    return { deleted: true };
  }
}
