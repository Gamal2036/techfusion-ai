import { Controller, Post, Body, Req, Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { throttle } from '../config/rate-limits';
import { AuthService, sanitizeUserAgent, SessionMetadata } from './auth.service';
import { Public } from '../common/public.decorator';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyLoginDto } from './dto/verify-login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { IncomingMessage } from 'http';

// Server-observed session metadata (ACC-SEC-02D2A). Values come only from the
// request environment and never from a request body. There is deliberately no
// global trust-all-proxy mode: the documented platform deployment (behind a
// single proxy on the private interface) is handled by the conditional socket
// check below, and any other topology records the direct peer address, which
// is what the server actually observes.
function observedMetadata(req: IncomingMessage, userAgentHeader: string | undefined): SessionMetadata {
  const socket = (req as { socket?: { remoteAddress?: string } }).socket;
  const forwardedFor = req.headers['x-forwarded-for'];
  const remote = socket?.remoteAddress;
  let ipAddress: string | undefined;
  if (forwardedFor) {
    const first = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    const candidate = first?.trim();
    if (candidate && candidate.length > 0 && candidate.length <= 45) {
      ipAddress = candidate;
    }
  } else if (remote) {
    ipAddress = remote;
  }
  return {
    ipAddress,
    userAgent: sanitizeUserAgent(userAgentHeader),
  };
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle(throttle(3, 300000))
  @Post('signup')
  async signup(@Body() body: SignupDto, @Req() req: IncomingMessage, @Headers('user-agent') ua?: string) {
    return this.authService.signup(body, observedMetadata(req, ua));
  }

  @Public()
  @Throttle(throttle(5, 60000))
  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: IncomingMessage, @Headers('user-agent') ua?: string) {
    return this.authService.login(body, observedMetadata(req, ua));
  }

  @Public()
  @Throttle(throttle(10, 60000))
  @Post('verify-login')
  async verifyLogin(@Body() body: VerifyLoginDto, @Req() req: IncomingMessage, @Headers('user-agent') ua?: string) {
    return this.authService.verifyLoginMfa(body.userId, body.token, body.recoveryCode, observedMetadata(req, ua));
  }

  @Public()
  @Throttle(throttle(5, 60000))
  @Post('refresh')
  async refresh(@Body() body: RefreshDto, @Req() req: IncomingMessage, @Headers('user-agent') ua?: string) {
    return this.authService.refresh(body.refreshToken, observedMetadata(req, ua));
  }

  @Post('logout')
  async logout(@Req() req: any) {
    await this.authService.logout(req.user.sub);
    return { message: 'Logged out' };
  }
}
