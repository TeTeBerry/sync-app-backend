import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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

  @Get('health')
  health() {
    return this.userService.ping();
  }

  @Get('me')
  me(
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.userService.getMe(userId, authorName);
  }

  @Patch('me')
  updateMe(
    @Body() body: UpdateUserMeDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.userService.patchMe(body, userId, authorName);
  }

  @Get('blocks')
  listBlocks(
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.userBlockService.listBlocksForClient(userId, authorName);
  }

  @Post('blocks')
  blockUser(
    @Body() body: BlockUserDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.userBlockService.blockForClient(
      body.blockedUserId,
      userId,
      authorName,
    );
  }

  @Delete('blocks/:blockedUserId')
  unblockUser(
    @Param('blockedUserId') blockedUserId: string,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.userBlockService.unblockForClient(
      blockedUserId,
      userId,
      authorName,
    );
  }
}
