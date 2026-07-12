import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { buildAuthCapabilities } from '../../common/auth/auth-capabilities';
import { Public } from '../../common/auth/public.decorator';
import { UserService } from '../user/user.service';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../user/interfaces/user.repository.interface';
import { AuthEmailService } from './auth-email.service';
import { EmailLoginDto } from './dto/email-login.dto';

const ANON_CAPABILITIES = {
  canCreateSquadProfile: false,
  canEditSquadProfile: false,
  canBrowseMatches: false,
  canSendConnectionRequest: false,
  canViewSentRequests: false,
  canViewReceivedRequests: false,
  canManageSquadVisibility: false,
  canUseMessaging: false,
  canSharePhoneNumber: false,
  canUsePayments: false,
  canCreatePaymentRequests: false,
  canConfirmAaTransfers: false,
  canPublishBookingDetails: false,
  canAccessSensitiveTravelDetails: false,
  canAccessRoommateVerification: false,
} as const;

@Controller('auth')
export class AuthEmailController {
  constructor(
    private readonly authEmailService: AuthEmailService,
    private readonly userService: UserService,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
  ) {}

  /**
   * Temporary Raven email-only login (unverified).
   * Same success copy for new and returning users.
   */
  @Public()
  @Post('email-login')
  emailLogin(@Body() body: EmailLoginDto, @Req() req: Request) {
    return this.authEmailService.loginWithEmail(body.email, req, {
      returnUrl: body.returnUrl,
      intendedAction: body.intendedAction,
    });
  }

  /**
   * JWT session probe for Raven / Nest consumers.
   * Anonymous callers receive signedIn:false.
   */
  @Public()
  @Get('session')
  async session(@CurrentActor() actor: RequestActor) {
    const userId = actor.resolvedUserId?.trim();
    if (!userId || actor.source === 'anonymous') {
      return {
        signedIn: false,
        user: null,
        capabilities: ANON_CAPABILITIES,
        tempEmailOnlyAuthEnabled: this.authEmailService.isEnabled(),
      };
    }

    const record = await this.users.findByExternalId(userId);
    const user = await this.userService.getMe(actor);
    return {
      signedIn: true,
      user: {
        id: user.id,
        name: user.name,
        email: record?.email ?? null,
        emailVerified: record?.emailVerifiedAt != null,
        emailVerifiedAt: record?.emailVerifiedAt ?? null,
      },
      capabilities: buildAuthCapabilities(record?.emailVerifiedAt ?? null),
      tempEmailOnlyAuthEnabled: this.authEmailService.isEnabled(),
    };
  }
}
