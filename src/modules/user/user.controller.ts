import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { UpdateUserMeDto } from './dto/update-user-me.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

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
}
