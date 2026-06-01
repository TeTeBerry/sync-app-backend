import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { BlockUserDto } from './dto/block-user.dto';
import { UpdateUserMeDto } from './dto/update-user-me.dto';
import { UserBlockService } from './user-block.service';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userBlockService: UserBlockService,
  ) {}

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

  @Get('blocks')
  listBlocks(@CurrentActor() actor: RequestActor) {
    return this.userBlockService.listBlocksForClient(actor);
  }

  @Post('blocks')
  blockUser(@Body() body: BlockUserDto, @CurrentActor() actor: RequestActor) {
    return this.userBlockService.blockForClient(body.blockedUserId, actor);
  }

  @Delete('blocks/:blockedUserId')
  unblockUser(
    @Param('blockedUserId') blockedUserId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.userBlockService.unblockForClient(blockedUserId, actor);
  }
}
