import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { WechatMessageService } from './wechat-message.service';

@Controller('wechat/message')
export class WechatMessageController {
  constructor(private readonly wechatMessage: WechatMessageService) {}

  @Public()
  @Get()
  verify(
    @Query('signature') signature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Query('echostr') echostr: string,
    @Res() res: Response,
  ): void {
    if (this.wechatMessage.verifySignature(signature, timestamp, nonce)) {
      res.type('text/plain').send(echostr ?? '');
      return;
    }
    res.status(403).send('invalid signature');
  }

  @Public()
  @Post()
  @HttpCode(200)
  async receive(
    @Query('signature') signature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Body() body: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.wechatMessage.verifySignature(signature, timestamp, nonce)) {
      res.status(403).send('invalid signature');
      return;
    }

    const payload =
      body && typeof body === 'object' && Object.keys(body as object).length
        ? body
        : typeof req.body === 'string'
          ? req.body
          : body;

    await this.wechatMessage.handlePayload(payload);
    res.type('text/plain').send('success');
  }
}
